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
import { domainApisPath, type DomainApi } from "$lib/services/domainApis";
import { loadEntityNames, domainApiExplorerEndpoints } from "$lib/server/domainApis";

const logger = createLogger("EditDomainApiPage");

export const load: PageServerLoad = async ({ locals, params }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  const token = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!token) throw error(401, "No API access token available");

  let domainApi: DomainApi;
  try {
    domainApi = await obp_requests.get(domainApisPath(params.bank_id, params.domain_api_id), token);
  } catch (e) {
    throw error(404, `No Domain API ${params.domain_api_id} in ${params.bank_id}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const entityNames = await loadEntityNames(token, domainApi.bank_id).catch((e) => {
    logger.warn(`Could not load the Dynamic Entities of ${domainApi.bank_id}:`, e);
    return [] as string[];
  });
  return { domainApi, entityNames, endpoints: domainApiExplorerEndpoints(["get", "update", "delete"]) };
};
