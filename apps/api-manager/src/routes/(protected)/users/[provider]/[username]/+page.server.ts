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
const logger = createLogger("UserDetailPageServer");
import type { PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ locals, params }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  const { provider, username } = params;

  if (!provider || !username) {
    throw error(400, "Provider and username are required");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for user detail API call");
    return {
      user: null,
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  let user = null;

  try {
    // Fetch user details from OBP API
    logger.info("=== USER DETAIL API CALL ===");
    const endpoint = `/obp/v6.0.0/users/provider/${encodeURIComponent(provider)}/username/${encodeURIComponent(username)}`;
    logger.info(`Request: ${endpoint}`);

    const response = await obp_requests.get(endpoint, accessToken);

    logger.info(`Response: User ${username} from provider ${provider}`);

    if (response) {
      user = response;
    } else {
      logger.warn("NO USER DATA IN RESPONSE");
      return {
        user: null,
        provider,
        username,
        hasApiAccess: true,
        error: "User not found",
      };
    }
  } catch (err) {
    logger.error("ERROR FETCHING USER DETAIL:");
    logger.error(`  Error type: ${err?.constructor?.name}`);
    logger.error(
      `  Error message: ${err instanceof Error ? err.message : String(err)}`,
    );

    return {
      user: null,
      provider,
      username,
      hasApiAccess: false,
      error: err instanceof Error ? err.message : "Failed to load user details",
    };
  }

  return {
    user,
    provider,
    username,
    hasApiAccess: true,
  };
};
