/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
/**
 * The Glossary as consumers see it, from GET /obp/v7.0.0/api/glossary: static Glossary Items
 * unioned with Dynamic ones, each flagged with where it came from.
 *
 * Distinct from glossaryCache.ts, which reads the STABLE v4.0.0 endpoint for the single entries
 * that help pages render. This one carries the provenance flags and backs the Glossary pages.
 *
 * Dynamic Items can change at any moment, so a plain time-based cache would show stale text right
 * after someone edited an entry. The endpoint documents an ETag for exactly this, so every load
 * revalidates with If-None-Match: a 304 is cheap and keeps the rendered HTML we already have.
 *
 * Not every build actually sends the ETag, and the payload is ~1 MB, so when the header is absent
 * we fall back to a short time window rather than re-reading it on every click. `?refresh=1`
 * bypasses both, and the pages carry a Refresh link because of it.
 */
import { createLogger } from "@obp/shared/utils";
import { renderMarkdown } from "@obp/shared/markdown";
import { obp_requests } from "$lib/obp/requests";
import { apiExplorerBaseUrl, glossaryEntryUrl } from "$lib/server/glossaryCache";

const logger = createLogger("ApiGlossaryCache");

export const API_GLOSSARY_PATH = "/obp/v7.0.0/api/glossary";

/** One entry exactly as v7.0.0 returns it. */
export interface ApiGlossaryItem {
  title: string;
  description: { markdown: string; html: string };
  /** From the DynamicGlossaryItem table rather than the API source. */
  is_dynamic: boolean;
  /** This Dynamic Item is displacing a static Glossary Item of the same title. */
  overrides_static_item: boolean;
}

/** A row for the index: everything the list needs, none of the body. */
export interface GlossaryIndexRow {
  title: string;
  is_dynamic: boolean;
  overrides_static_item: boolean;
  excerpt: string;
}

export interface GlossaryEntryView {
  title: string;
  markdown: string;
  /** Rendered by the Manager from the markdown, with in-glossary links pointed at these pages. */
  html: string;
  is_dynamic: boolean;
  overrides_static_item: boolean;
}

interface CacheState {
  items: ApiGlossaryItem[];
  /** Exact title to entry, first occurrence winning. */
  byTitle: Map<string, ApiGlossaryItem>;
  /** Lowercased title, as a fallback for a hand-typed URL that differs only in case. */
  byLowerTitle: Map<string, ApiGlossaryItem>;
  /** Anchor form used in glossary markdown links ("Some-Term") to the real title. */
  anchorToTitle: Map<string, string>;
  /**
   * Titles the Glossary serves more than once. Two static Items can share a title (they are
   * declared in different files), and the page reports them rather than hiding the collision.
   */
  duplicateTitles: string[];
  /** Rendered HTML per title, filled in as entries are read. Dropped when the ETag moves. */
  rendered: Map<string, string>;
  etag: string | null;
  fetchedAt: number | null;
}

const empty = (): CacheState => ({
  items: [],
  byTitle: new Map(),
  byLowerTitle: new Map(),
  anchorToTitle: new Map(),
  duplicateTitles: [],
  rendered: new Map(),
  etag: null,
  fetchedAt: null,
});

/** How long to trust the cache when the response carried no ETag to revalidate against. */
const MAX_AGE_WITHOUT_ETAG = 60_000;

let cache: CacheState = empty();
let inFlight: Promise<CacheState> | null = null;

/** Glossary markdown links to other entries by anchor: `[here](/glossary#Transaction-Request)`. */
function anchorForms(title: string): string[] {
  return [title, title.replace(/\s+/g, "-")];
}

function indexItems(items: ApiGlossaryItem[]): CacheState {
  const byTitle = new Map<string, ApiGlossaryItem>();
  const byLowerTitle = new Map<string, ApiGlossaryItem>();
  const anchorToTitle = new Map<string, string>();
  const duplicateTitles: string[] = [];
  for (const item of items) {
    if (byTitle.has(item.title)) {
      duplicateTitles.push(item.title);
      continue; // first occurrence wins, so the index and the entry pages agree
    }
    byTitle.set(item.title, item);
    if (!byLowerTitle.has(item.title.toLowerCase())) byLowerTitle.set(item.title.toLowerCase(), item);
    for (const form of anchorForms(item.title)) {
      const key = form.toLowerCase();
      if (!anchorToTitle.has(key)) anchorToTitle.set(key, item.title);
    }
  }
  return {
    items,
    byTitle,
    byLowerTitle,
    anchorToTitle,
    duplicateTitles,
    rendered: new Map(),
    etag: null,
    fetchedAt: Date.now(),
  };
}

/**
 * The Glossary, revalidated against OBP on every call. `force` skips If-None-Match so a
 * ?refresh=1 always re-reads. A failed revalidation with a warm cache serves the cache.
 */
export async function fetchApiGlossary(accessToken: string, force = false): Promise<CacheState> {
  if (!force && cache.items.length > 0 && !cache.etag && cache.fetchedAt !== null) {
    // Nothing to revalidate against, so re-reading a megabyte would buy only freshness we can
    // get from the Refresh link instead.
    if (Date.now() - cache.fetchedAt < MAX_AGE_WITHOUT_ETAG) return cache;
  }
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    if (cache.etag && !force) headers["If-None-Match"] = cache.etag;
    try {
      const response = await fetch(`${obp_requests.instance.base_url}${API_GLOSSARY_PATH}`, { headers });
      if (response.status === 304 && cache.items.length > 0) {
        logger.info(`Glossary unchanged (304, ${cache.items.length} items)`);
        return cache;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message ?? `GET ${API_GLOSSARY_PATH} failed (HTTP ${response.status})`);
      }
      const data = await response.json();
      const items = (data?.glossary_items ?? []) as ApiGlossaryItem[];
      const next = indexItems(items);
      next.etag = response.headers.get("etag");
      cache = next;
      logger.info(`Cached ${items.length} glossary items (etag ${next.etag ?? "none"})`);
      return cache;
    } catch (e) {
      if (cache.items.length > 0) {
        logger.warn("Could not revalidate the glossary, serving the cached copy:", e);
        return cache;
      }
      throw e;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Markdown reduced to a plain-text one-liner, for the index. */
export function excerptFromMarkdown(markdown: string, max = 200): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/^\s*#{1,6}\s+/gm, "") // heading markers
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links keep their text
    .replace(/<[^>]+>/g, " ") // inline html
    .replace(/[*_`>|]/g, "")
    .replace(/^\s*[-+*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, "") + "…" : text;
}

/**
 * Links between glossary entries are written site-relative to the API Explorer
 * (`[here](/glossary#Some-Term)`). Point them at these pages when the anchor resolves to an
 * entry we have, and at the Explorer when it does not, so no link silently 404s here.
 */
function rewriteInGlossaryLinks(markdown: string, anchorToTitle: Map<string, string>): string {
  const explorer = apiExplorerBaseUrl();
  return markdown.replace(/\]\(\/glossary(#([^)]*))?\)/g, (_match, _hash, anchor) => {
    if (!anchor) return `](/glossary)`;
    const decoded = decodeURIComponent(anchor).toLowerCase();
    const title = anchorToTitle.get(decoded) ?? anchorToTitle.get(decoded.replace(/-/g, " "));
    return title ? `](/glossary/${encodeURIComponent(title)})` : `](${explorer}/glossary#${anchor})`;
  });
}

/** Every entry, as index rows sorted by title. */
export async function loadGlossaryIndex(
  accessToken: string,
  force = false,
): Promise<{ rows: GlossaryIndexRow[]; etag: string | null; duplicateTitles: string[] }> {
  const state = await fetchApiGlossary(accessToken, force);
  const rows = [...state.byTitle.values()]
    .map((i) => ({
      title: i.title,
      is_dynamic: i.is_dynamic,
      overrides_static_item: i.overrides_static_item,
      excerpt: excerptFromMarkdown(i.description.markdown),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
  return { rows, etag: state.etag, duplicateTitles: state.duplicateTitles };
}

/** One entry, rendered. Undefined when this Glossary has no such title. */
export async function loadGlossaryEntry(
  accessToken: string,
  title: string,
  force = false,
): Promise<GlossaryEntryView | undefined> {
  const state = await fetchApiGlossary(accessToken, force);
  // Titles that differ only in case are separate entries, so an exact match has to win.
  const item = state.byTitle.get(title) ?? state.byLowerTitle.get(title.toLowerCase());
  if (!item) return undefined;
  let html = state.rendered.get(item.title);
  if (html === undefined) {
    // markdown-it runs with html:false, so raw HTML in the source is escaped, not executed.
    html = renderMarkdown(rewriteInGlossaryLinks(item.description.markdown, state.anchorToTitle));
    state.rendered.set(item.title, html);
  }
  return {
    title: item.title,
    markdown: item.description.markdown,
    html,
    is_dynamic: item.is_dynamic,
    overrides_static_item: item.overrides_static_item,
  };
}

/** Titles whose title or body contains `query`, for a search the index alone could not answer. */
export async function searchGlossary(accessToken: string, query: string): Promise<Set<string>> {
  const state = await fetchApiGlossary(accessToken);
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return new Set(state.items.map((i) => i.title));
  const matches = new Set<string>();
  for (const item of state.items) {
    const haystack = `${item.title}\n${item.description.markdown}`.toLowerCase();
    if (terms.every((t) => haystack.includes(t))) matches.add(item.title);
  }
  return matches;
}

/** The API Explorer's own page for an entry, for a "see it as developers do" link. */
export function explorerGlossaryUrl(title: string): string {
  return glossaryEntryUrl(title);
}
