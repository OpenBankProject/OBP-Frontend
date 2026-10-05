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
import { obp_requests } from "$lib/obp/requests";
import { domainApisPath, spaceOf, type DomainApi } from "$lib/services/domainApis";
import { loadBankIds, domainApiExplorerEndpoints } from "$lib/server/domainApis";

const logger = createLogger("DomainApisPage");

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  const bankId = spaceOf(url.searchParams.get("bank_id"));

  let domainApis: DomainApi[] = [];
  let loadError: string | null = null;
  try {
    const resp = await obp_requests.get(domainApisPath(bankId), token);
    domainApis = (resp?.domain_apis ?? []).sort((a: DomainApi, b: DomainApi) => a.base_path.localeCompare(b.base_path));
  } catch (e) {
    logger.error(`Could not load the Domain APIs of ${bankId}:`, e);
    loadError = e instanceof Error ? e.message : String(e);
  }

  let bankIds: string[] = [];
  try {
    bankIds = await loadBankIds(token);
  } catch (e) {
    logger.warn("Could not load banks for the space picker:", e);
  }

  return { bankId, bankIds, domainApis, loadError, endpoints: domainApiExplorerEndpoints(["list", "create", "delete"]) };
};
