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
import { loadGlossaryItems } from "$lib/server/glossaryItems";
import { glossaryEntryUrl, apiExplorerBaseUrl, explorerResourceDocUrl } from "$lib/server/glossaryCache";
import type { GlossaryItem } from "$lib/services/glossaryItems";

const logger = createLogger("GlossaryItemsPage");

const PAGE_SIZE = 100;

/** The endpoints behind this page, linked to their resource docs in the API Explorer. */
const ENDPOINTS = [
  { operation_id: "OBPv7.0.0-getGlossary", verb: "GET", path: "/obp/v7.0.0/api/glossary" },
  { operation_id: "OBPv7.0.0-createGlossaryItem", verb: "POST", path: "/obp/v7.0.0/api/glossary" },
  { operation_id: "OBPv7.0.0-updateGlossaryItem", verb: "PUT", path: "/obp/v7.0.0/api/glossary/TITLE" },
  { operation_id: "OBPv7.0.0-deleteGlossaryItem", verb: "DELETE", path: "/obp/v7.0.0/api/glossary/TITLE" },
];

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const titleFilter = url.searchParams.get("title")?.trim() ?? "";
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const explorerUrl = apiExplorerBaseUrl();

  let rows: (GlossaryItem & { explorerUrl: string })[] = [];
  let pagination = { total: 0, limit: PAGE_SIZE, offset };
  let loadError: string | null = null;
  try {
    const page = await loadGlossaryItems(token, {
      search: titleFilter || undefined,
      limit: PAGE_SIZE,
      offset,
    });
    pagination = page.pagination;
    rows = page.glossary_items
      .map((i) => ({ ...i, explorerUrl: glossaryEntryUrl(i.title, explorerUrl) }))
      .sort((a, b) => a.title.localeCompare(b.title));
  } catch (e) {
    logger.error("Could not load Dynamic Glossary Items:", e);
    loadError = e instanceof Error ? e.message : String(e);
  }

  return {
    rows,
    pagination,
    titleFilter,
    pageSize: PAGE_SIZE,
    explorerUrl,
    loadError,
    endpoints: ENDPOINTS.map((e) => ({ ...e, url: explorerResourceDocUrl(e.operation_id, explorerUrl) })),
  };
};
