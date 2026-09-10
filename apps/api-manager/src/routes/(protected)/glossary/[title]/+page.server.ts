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
import { loadGlossaryEntry, explorerGlossaryUrl } from "$lib/server/apiGlossaryCache";
import { explorerResourceDocUrl } from "$lib/server/glossaryCache";

const ENDPOINTS = [
  { operation_id: "OBPv7.0.0-getApiGlossary", verb: "GET", path: "/obp/v7.0.0/api/glossary" },
];

export const load: PageServerLoad = async ({ locals, params, url }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const force = url.searchParams.get("refresh") === "1";
  const entry = await loadGlossaryEntry(token, params.title, force);
  if (!entry) throw error(404, `The Glossary has no entry titled "${params.title}".`);

  return {
    entry,
    explorerUrl: explorerGlossaryUrl(entry.title),
    endpoints: ENDPOINTS.map((e) => ({ ...e, url: explorerResourceDocUrl(e.operation_id) })),
  };
};
