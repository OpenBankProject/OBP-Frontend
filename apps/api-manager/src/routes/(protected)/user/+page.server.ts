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
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from "@obp/shared/utils";

const logger = createLogger("UserPageServer");

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    logger.warn("No user session found");
    return {
      entitlementRequests: [],
      hasApiAccess: false,
      error: "No user session",
    };
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for entitlement requests");
    return {
      entitlementRequests: [],
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    logger.info("=== FETCHING MY ENTITLEMENT REQUESTS ===");
    const endpoint = `/obp/v6.0.0/my/entitlement-requests`;
    logger.info(`Request: GET ${endpoint}`);

    const response = await obp_requests.get(endpoint, accessToken);

    const requests = response.entitlement_requests || [];
    logger.info(`Response: ${requests.length} entitlement requests`);

    return {
      entitlementRequests: requests,
      hasApiAccess: true,
      error: null,
    };
  } catch (err) {
    logger.error("Error fetching entitlement requests:", err);

    const errorMessage =
      err instanceof Error
        ? err.message
        : "Failed to fetch entitlement requests";

    return {
      entitlementRequests: [],
      hasApiAccess: true,
      error: errorMessage,
    };
  }
};
