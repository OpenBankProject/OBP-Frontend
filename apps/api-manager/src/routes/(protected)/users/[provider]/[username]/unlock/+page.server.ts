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
const logger = createLogger("UnlockUserPageServer");
import type { PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { extractErrorDetails } from '$lib/obp/errors';
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { error, fail, redirect } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";

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
    logger.warn("No access token available for unlock user API call");
    return {
      user: null,
      hasApiAccess: false,
      error: "No API access token available",
      lockStatus: null,
    };
  }

  // Fetch user details
  let user = null;
  try {
    const endpoint = `/obp/v6.0.0/users/provider/${encodeURIComponent(provider)}/username/${encodeURIComponent(username)}`;
    const response = await obp_requests.get(endpoint, accessToken);
    if (response) {
      user = response;
    }
  } catch (err) {
    logger.error(`Error fetching user details: ${err instanceof Error ? err.message : String(err)}`);
    return {
      user: null,
      provider,
      username,
      hasApiAccess: false,
      error: err instanceof Error ? err.message : "Failed to load user details",
      lockStatus: null,
    };
  }

  // Fetch lock status (non-fatal if it fails)
  let lockStatus = null;
  try {
    const lockEndpoint = `/obp/v6.0.0/users/${encodeURIComponent(provider)}/${encodeURIComponent(username)}/lock-status`;
    lockStatus = await obp_requests.get(lockEndpoint, accessToken);
    logger.info(`Lock status fetched for ${username}`);
  } catch (err) {
    logger.warn(`Could not fetch lock status: ${err instanceof Error ? err.message : String(err)}`);
  }

  return {
    user,
    provider,
    username,
    hasApiAccess: true,
    lockStatus,
  };
};

export const actions = {
  unlockUser: async (event: RequestEvent) => {
    const session = event.locals.session;

    if (!session?.data?.user) {
      return fail(401, { error: "Unauthorized", action: "unlockUser" });
    }

    const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
    const token = sessionOAuth?.accessToken;

    if (!token) {
      return fail(401, { error: "Unauthorized: No access token found in session.", action: "unlockUser" });
    }

    const { provider, username } = event.params;

    if (!provider || !username) {
      return fail(400, { error: "Provider and username are required.", action: "unlockUser" });
    }

    try {
      const unlockEndpoint = `/obp/v6.0.0/users/${encodeURIComponent(provider)}/${encodeURIComponent(username)}/lock-status`;
      const result = await obp_requests.put(unlockEndpoint, {}, token);

      logger.info(`User ${username} unlocked successfully`, result);

      throw redirect(303, `/users/${encodeURIComponent(provider)}/${encodeURIComponent(username)}`);
    } catch (e: any) {
      if (e.status === 303) throw e;
      logger.error("Error unlocking user:", e);
      const { message } = extractErrorDetails(e);
      return fail(500, { error: message, action: "unlockUser" });
    }
  },
};
