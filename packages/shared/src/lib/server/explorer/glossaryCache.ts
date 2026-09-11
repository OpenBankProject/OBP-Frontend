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
 * The OBP glossary, cached per process and revalidated with an ETag.
 *
 * The glossary is a megabyte and changes only when OBP-API is deployed or a dynamic item
 * is edited, so it is fetched whole and revalidated with If-None-Match rather than re-read.
 * When the response carries no ETag there is nothing to revalidate against, so a short
 * window is trusted instead and callers offer a refresh.
 *
 * Lifted out of the API Manager so the Portal's API Explorer serves the same glossary with
 * the same duplicate-title and anchor handling. Readable anonymously, so `token` is
 * optional.
 */
import { createLogger } from '$shared/utils/logger';
import { renderMarkdown } from '../../markdown/index.js';

const logger = createLogger('GlossaryCache');

export const API_GLOSSARY_PATH = '/obp/v7.0.0/api/glossary';

/** One entry exactly as v7.0.0 returns it. */
export interface ApiGlossaryItem {
	title: string;
	description: { markdown: string; html: string };
	/** From the DynamicGlossaryItem table rather than the API source. */
	is_dynamic: boolean;
	/** This dynamic item is displacing a static glossary item of the same title. */
	overrides_static_item: boolean;
}

/** A row for the index: everything a list needs, none of the body. */
export interface GlossaryIndexRow {
	title: string;
	is_dynamic: boolean;
	overrides_static_item: boolean;
	excerpt: string;
}

export interface GlossaryEntryView {
	title: string;
	markdown: string;
	html: string;
	is_dynamic: boolean;
	overrides_static_item: boolean;
}

export interface GlossaryOptions {
	/** OBP's base URL. */
	baseUrl: string;
	/** Optional: the glossary is public. */
	token?: string;
	force?: boolean;
}

export interface GlossaryCacheState {
	items: ApiGlossaryItem[];
	byTitle: Map<string, ApiGlossaryItem>;
	byLowerTitle: Map<string, ApiGlossaryItem>;
	/** Anchor form used in glossary links ("Some-Term"), lowercased, to the real title. */
	anchorToTitle: Map<string, string>;
	/**
	 * Titles the glossary serves more than once. Two static items can share a title, and
	 * case-variant titles are separate entries — callers report the collision rather than
	 * hide it. Keying an {#each} on title without this throws each_key_duplicate.
	 */
	duplicateTitles: string[];
	etag: string | null;
	fetchedAt: number | null;
}

const empty = (): GlossaryCacheState => ({
	items: [],
	byTitle: new Map(),
	byLowerTitle: new Map(),
	anchorToTitle: new Map(),
	duplicateTitles: [],
	etag: null,
	fetchedAt: null
});

/** How long to trust the cache when the response carried no ETag. */
const MAX_AGE_WITHOUT_ETAG = 60_000;

let cache: GlossaryCacheState = empty();
let inFlight: Promise<GlossaryCacheState> | null = null;

/** Glossary links point at entries by anchor: `[here](/glossary#Transaction-Request)`. */
function anchorForms(title: string): string[] {
	return [title, title.replace(/\s+/g, '-')];
}

function indexItems(items: ApiGlossaryItem[]): GlossaryCacheState {
	const byTitle = new Map<string, ApiGlossaryItem>();
	const byLowerTitle = new Map<string, ApiGlossaryItem>();
	const anchorToTitle = new Map<string, string>();
	const duplicateTitles: string[] = [];
	for (const item of items) {
		if (byTitle.has(item.title)) {
			duplicateTitles.push(item.title);
			continue; // first occurrence wins, so index and entry pages agree
		}
		byTitle.set(item.title, item);
		if (!byLowerTitle.has(item.title.toLowerCase())) byLowerTitle.set(item.title.toLowerCase(), item);
		for (const form of anchorForms(item.title)) {
			const key = form.toLowerCase();
			if (!anchorToTitle.has(key)) anchorToTitle.set(key, item.title);
		}
	}
	return { items, byTitle, byLowerTitle, anchorToTitle, duplicateTitles, etag: null, fetchedAt: Date.now() };
}

export async function fetchApiGlossary(options: GlossaryOptions): Promise<GlossaryCacheState> {
	const { baseUrl, token, force = false } = options;

	if (!force && cache.items.length > 0 && !cache.etag && cache.fetchedAt !== null) {
		if (Date.now() - cache.fetchedAt < MAX_AGE_WITHOUT_ETAG) return cache;
	}
	if (inFlight) return inFlight;

	inFlight = (async () => {
		const headers: Record<string, string> = {};
		if (token) headers.Authorization = `Bearer ${token}`;
		if (cache.etag && !force) headers['If-None-Match'] = cache.etag;
		try {
			const response = await fetch(`${baseUrl.replace(/\/$/, '')}${API_GLOSSARY_PATH}`, { headers });
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
			next.etag = response.headers.get('etag');
			cache = next;
			logger.info(`Cached ${items.length} glossary items (etag ${next.etag ?? 'none'})`);
			return cache;
		} catch (e) {
			if (cache.items.length > 0) {
				logger.warn('Could not revalidate the glossary, serving the cached copy:', e);
				return cache;
			}
			throw e;
		} finally {
			inFlight = null;
		}
	})();

	return inFlight;
}

/** Markdown reduced to a plain-text one-liner, for an index row. */
export function excerptFromMarkdown(markdown: string, max = 200): string {
	const text = markdown
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/^\s*#{1,6}\s+/gm, '')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/<[^>]+>/g, ' ')
		.replace(/[*_`>|]/g, '')
		.replace(/^\s*[-+*]\s+/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
	return text.length > max ? text.slice(0, max).replace(/\s+\S*$/, '') + '…' : text;
}

export interface GlossaryLinkTargets {
	/** Where an entry this glossary has should link to. */
	entryHref: (title: string) => string;
	/** Where the glossary index lives. */
	indexHref: string;
	/** Where an anchor with no matching entry should go, so no link silently 404s. */
	fallbackHref: (anchor: string) => string;
}

/**
 * Links between entries are written site-relative to the API Explorer
 * (`[here](/glossary#Some-Term)`). Point them at pages that exist.
 */
export function rewriteInGlossaryLinks(
	markdown: string,
	anchorToTitle: Map<string, string>,
	targets: GlossaryLinkTargets
): string {
	return markdown.replace(/\]\(\/glossary(#([^)]*))?\)/g, (_match, _hash, anchor) => {
		if (!anchor) return `](${targets.indexHref})`;
		const decoded = decodeURIComponent(anchor).toLowerCase();
		const title = anchorToTitle.get(decoded) ?? anchorToTitle.get(decoded.replace(/-/g, ' '));
		return title ? `](${targets.entryHref(title)})` : `](${targets.fallbackHref(anchor)})`;
	});
}

/** Every entry, as index rows sorted by title. */
export async function loadGlossaryIndex(
	options: GlossaryOptions
): Promise<{ rows: GlossaryIndexRow[]; etag: string | null; duplicateTitles: string[] }> {
	const state = await fetchApiGlossary(options);
	const rows = [...state.byTitle.values()]
		.map((i) => ({
			title: i.title,
			is_dynamic: i.is_dynamic,
			overrides_static_item: i.overrides_static_item,
			excerpt: excerptFromMarkdown(i.description.markdown)
		}))
		.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
	return { rows, etag: state.etag, duplicateTitles: state.duplicateTitles };
}

/**
 * One entry, rendered. Undefined when this glossary has no such title.
 *
 * The HTML is rendered per call rather than cached: the link rewriting depends on where the
 * caller's glossary lives, and a cache shared between two callers with different targets
 * would hand one of them the other's links. Rendering a single entry is cheap.
 */
export async function loadGlossaryEntry(
	title: string,
	options: GlossaryOptions & { targets: GlossaryLinkTargets }
): Promise<GlossaryEntryView | undefined> {
	const state = await fetchApiGlossary(options);
	// Titles differing only in case are separate entries, so an exact match has to win.
	const item = state.byTitle.get(title) ?? state.byLowerTitle.get(title.toLowerCase());
	if (!item) return undefined;
	// markdown-it runs with html:false, so raw HTML in the source is escaped, not executed.
	const html = renderMarkdown(
		rewriteInGlossaryLinks(item.description.markdown, state.anchorToTitle, options.targets)
	);
	return {
		title: item.title,
		markdown: item.description.markdown,
		html,
		is_dynamic: item.is_dynamic,
		overrides_static_item: item.overrides_static_item
	};
}

/** Titles whose title or body contains every term of `query`. */
export async function searchGlossary(query: string, options: GlossaryOptions): Promise<Set<string>> {
	const state = await fetchApiGlossary(options);
	const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) return new Set(state.items.map((i) => i.title));
	const matches = new Set<string>();
	for (const item of state.items) {
		const haystack = `${item.title}\n${item.description.markdown}`.toLowerCase();
		if (terms.every((t) => haystack.includes(t))) matches.add(item.title);
	}
	return matches;
}

/**
 * A resolver from the anchor form used in glossary links ("Bank.bank_id", "Some-Term") to
 * the real entry title, so another page can link into the glossary without loading it
 * itself. Returns undefined for anchors this glossary has no entry for.
 */
export async function glossaryAnchorResolver(
	options: GlossaryOptions
): Promise<(anchor: string) => string | undefined> {
	const state = await fetchApiGlossary(options);
	return (anchor: string) => {
		const decoded = decodeURIComponent(anchor).toLowerCase();
		return state.anchorToTitle.get(decoded) ?? state.anchorToTitle.get(decoded.replace(/-/g, ' '));
	};
}

export function clearGlossaryCache(): void {
	cache = empty();
}
