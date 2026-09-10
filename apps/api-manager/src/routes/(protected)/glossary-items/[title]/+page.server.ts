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
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { GLOSSARY_ITEMS_PATH } from "$lib/server/glossaryItems";
import { glossaryEntryUrl, apiExplorerBaseUrl, explorerResourceDocUrl } from "$lib/server/glossaryCache";

const ENDPOINTS = [
  { operation_id: "OBPv7.0.0-getDynamicGlossaryItem", verb: "GET", path: "/obp/v7.0.0/glossary-items/TITLE" },
  { operation_id: "OBPv7.0.0-updateDynamicGlossaryItem", verb: "PUT", path: "/obp/v7.0.0/glossary-items/TITLE" },
  { operation_id: "OBPv7.0.0-deleteDynamicGlossaryItem", verb: "DELETE", path: "/obp/v7.0.0/glossary-items/TITLE" },
];
import type { GlossaryItem } from "$lib/services/glossaryItems";

export const load: PageServerLoad = async ({ locals, params }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const title = params.title;
  let item: GlossaryItem;
  try {
    item = await obp_requests.get(`${GLOSSARY_ITEMS_PATH}/${encodeURIComponent(title)}`, token);
  } catch (e) {
    // The endpoint only sees Dynamic Items, so a 404 here can still mean a static entry exists.
    throw error(404, `No Dynamic Glossary Item titled "${title}": ${e instanceof Error ? e.message : String(e)}`);
  }

  return {
    item,
    explorerUrl: glossaryEntryUrl(item.title, apiExplorerBaseUrl()),
    endpoints: ENDPOINTS.map((e) => ({ ...e, url: explorerResourceDocUrl(e.operation_id) })),
  };
};
