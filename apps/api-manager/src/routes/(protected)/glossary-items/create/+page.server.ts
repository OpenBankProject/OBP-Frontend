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
import { loadGlossaryItems, loadStaticGlossaryTitles } from "$lib/server/glossaryItems";
import { explorerResourceDocUrl } from "$lib/server/glossaryCache";

const ENDPOINTS = [
  { operation_id: "OBPv7.0.0-createGlossaryItem", verb: "POST", path: "/obp/v7.0.0/api/glossary" },
];

const logger = createLogger("CreateGlossaryItemPage");

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  // Both lists are hints only: they let the form say "this title already exists" or
  // "this would shadow shipped text" before OBP has to answer with a 409.
  let existingTitles: string[] = [];
  let titlesError: string | null = null;
  try {
    existingTitles = (await loadGlossaryItems(token, { limit: 500 })).glossary_items.map((i) => i.title);
  } catch (e) {
    logger.warn("Could not load the existing Dynamic Glossary Items:", e);
    titlesError = e instanceof Error ? e.message : String(e);
  }
  const staticTitles = await loadStaticGlossaryTitles(token);

  // ?title=... prefills the term, e.g. from a link that says "document this".
  return {
    existingTitles,
    staticTitles,
    titlesError,
    prefillTitle: url.searchParams.get("title") ?? "",
    endpoints: ENDPOINTS.map((e) => ({ ...e, url: explorerResourceDocUrl(e.operation_id) })),
  };
};
