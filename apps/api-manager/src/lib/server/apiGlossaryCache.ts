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
import { obp_requests } from "$lib/obp/requests";
import { apiExplorerBaseUrl, glossaryEntryUrl } from "$lib/server/glossaryCache";
import {
  fetchApiGlossary as fetchShared,
  loadGlossaryIndex as loadIndexShared,
  loadGlossaryEntry as loadEntryShared,
  searchGlossary as searchShared,
  excerptFromMarkdown,
  API_GLOSSARY_PATH,
} from "@obp/shared/server/explorer";
import type {
  ApiGlossaryItem,
  GlossaryCacheState,
  GlossaryEntryView,
  GlossaryIndexRow,
  GlossaryLinkTargets,
} from "@obp/shared/server/explorer";

export { excerptFromMarkdown, API_GLOSSARY_PATH };
export type { ApiGlossaryItem, GlossaryEntryView, GlossaryIndexRow };

/**
 * The Manager's view of the shared glossary cache.
 *
 * The cache itself — ETag revalidation, duplicate titles, the anchor map — lives in
 * @obp/shared/server/explorer so the Manager and the Portal's API Explorer share one
 * implementation. This binds what is the Manager's own: which OBP to read, and where its
 * glossary pages live, so links between entries land on Manager routes.
 */
function options(accessToken: string, force = false) {
  return { baseUrl: obp_requests.instance.base_url, token: accessToken, force };
}

/** Entries link to Manager pages; an anchor with no entry here falls back to the Explorer. */
const MANAGER_TARGETS: GlossaryLinkTargets = {
  entryHref: (title) => `/glossary/${encodeURIComponent(title)}`,
  indexHref: "/glossary",
  fallbackHref: (anchor) => `${apiExplorerBaseUrl()}/glossary#${anchor}`,
};

export function fetchApiGlossary(accessToken: string, force = false): Promise<GlossaryCacheState> {
  return fetchShared(options(accessToken, force));
}

export function loadGlossaryIndex(
  accessToken: string,
  force = false,
): Promise<{ rows: GlossaryIndexRow[]; etag: string | null; duplicateTitles: string[] }> {
  return loadIndexShared(options(accessToken, force));
}

export function loadGlossaryEntry(
  accessToken: string,
  title: string,
  force = false,
): Promise<GlossaryEntryView | undefined> {
  return loadEntryShared(title, { ...options(accessToken, force), targets: MANAGER_TARGETS });
}

export function searchGlossary(accessToken: string, query: string): Promise<Set<string>> {
  return searchShared(query, options(accessToken));
}

/** The API Explorer's own page for an entry, for a "see it as developers do" link. */
export function explorerGlossaryUrl(title: string): string {
  return glossaryEntryUrl(title);
}
