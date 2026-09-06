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
import { createLogger } from "@obp/shared/utils";
const logger = createLogger("EntitlementRequestsPageServer");
import type { PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { error } from "@sveltejs/kit";

interface EntitlementRequest {
  entitlement_request_id: string;
  user: {
    user_id: string;
    username: string;
    email: string;
  };
  role_name: string;
  bank_id?: string;
  created: string;
}

interface EntitlementRequestsResponse {
  entitlement_requests: EntitlementRequest[];
}

const DEFAULT_LIMIT = 50;

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for entitlement requests API calls");
    return {
      entitlementRequests: [],
      hasApiAccess: false,
      error: "No API access token available",
      limit: DEFAULT_LIMIT,
      offset: 0,
    };
  }

  const limit = parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT));
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const sortDirection = url.searchParams.get("sort_direction") || "DESC";

  try {
    logger.info("=== ENTITLEMENT REQUESTS API CALL ===");
    const endpoint = `/obp/v6.0.0/entitlement-requests?limit=${limit}&offset=${offset}&sort_direction=${sortDirection}`;
    logger.info(`Request: ${endpoint}`);

    const response: EntitlementRequestsResponse = await obp_requests.get(
      endpoint,
      accessToken,
    );

    logger.info(
      `Response: ${response.entitlement_requests?.length || 0} entitlement requests`,
    );

    return {
      entitlementRequests: response.entitlement_requests || [],
      hasApiAccess: true,
      limit,
      offset,
    };
  } catch (err) {
    logger.error("Error loading entitlement requests:", err);

    return {
      entitlementRequests: [],
      hasApiAccess: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load entitlement requests",
      limit,
      offset,
    };
  }
};
