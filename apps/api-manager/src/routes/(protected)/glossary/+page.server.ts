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
import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "@obp/shared/utils";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { loadGlossaryIndex, searchGlossary, type GlossaryIndexRow } from "$lib/server/apiGlossaryCache";
import { apiExplorerBaseUrl, explorerResourceDocUrl } from "$lib/server/glossaryCache";

const logger = createLogger("GlossaryPage");

/** The endpoints behind this page, linked to their resource docs in the API Explorer. */
const ENDPOINTS = [
  { operation_id: "OBPv7.0.0-getApiGlossary", verb: "GET", path: "/obp/v7.0.0/api/glossary" },
];

/** "dynamic" and "static" are provenance; "overriding" is the subset worth an operator's attention. */
const SOURCES = ["all", "dynamic", "static", "overriding"] as const;
type Source = (typeof SOURCES)[number];

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const query = url.searchParams.get("q")?.trim() ?? "";
  const sourceParam = url.searchParams.get("source") ?? "all";
  const source: Source = (SOURCES as readonly string[]).includes(sourceParam) ? (sourceParam as Source) : "all";
  const force = url.searchParams.get("refresh") === "1";

  let rows: GlossaryIndexRow[] = [];
  let counts = { total: 0, dynamic: 0, static: 0, overriding: 0 };
  let duplicateTitles: string[] = [];
  let loadError: string | null = null;
  try {
    const index = await loadGlossaryIndex(token, force);
    rows = index.rows;
    duplicateTitles = index.duplicateTitles;
    counts = {
      total: rows.length,
      dynamic: rows.filter((r) => r.is_dynamic).length,
      static: rows.filter((r) => !r.is_dynamic).length,
      overriding: rows.filter((r) => r.overrides_static_item).length,
    };
    // Searching the bodies as well as the titles needs the full text, which only lives server side.
    if (query) {
      const matching = await searchGlossary(token, query);
      rows = rows.filter((r) => matching.has(r.title));
    }
    if (source === "dynamic") rows = rows.filter((r) => r.is_dynamic);
    else if (source === "static") rows = rows.filter((r) => !r.is_dynamic);
    else if (source === "overriding") rows = rows.filter((r) => r.overrides_static_item);
  } catch (e) {
    logger.error("Could not load the Glossary:", e);
    loadError = e instanceof Error ? e.message : String(e);
  }

  return {
    rows,
    counts,
    query,
    source,
    duplicateTitles,
    loadError,
    explorerUrl: apiExplorerBaseUrl(),
    endpoints: ENDPOINTS.map((e) => ({ ...e, url: explorerResourceDocUrl(e.operation_id) })),
  };
};
