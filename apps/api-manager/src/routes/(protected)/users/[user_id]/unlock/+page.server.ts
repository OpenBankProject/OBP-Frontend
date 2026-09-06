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

  const { user_id } = params;

  if (!user_id) {
    throw error(400, "User ID is required");
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for unlock user API call");
    return {
      user: null,
      user_id,
      hasApiAccess: false,
      error: "No API access token available",
      lockStatus: null,
    };
  }

  // Fetch user details by user_id
  let user = null;
  try {
    const endpoint = `/obp/v6.0.0/users/user-id/${encodeURIComponent(user_id)}`;
    const response = await obp_requests.get(endpoint, accessToken);
    if (response) {
      user = response;
    }
  } catch (err) {
    logger.error(`Error fetching user details: ${err instanceof Error ? err.message : String(err)}`);
    return {
      user: null,
      user_id,
      hasApiAccess: false,
      error: err instanceof Error ? err.message : "Failed to load user details",
      lockStatus: null,
    };
  }

  // Fetch lock status (non-fatal if it fails)
  let lockStatus = null;
  if (user?.provider && user?.username) {
    try {
      const lockEndpoint = `/obp/v6.0.0/users/${encodeURIComponent(user.provider)}/${encodeURIComponent(user.username)}/lock-status`;
      lockStatus = await obp_requests.get(lockEndpoint, accessToken);
      logger.info(`Lock status fetched for ${user.username}`);
    } catch (err) {
      logger.warn(`Could not fetch lock status: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    user,
    user_id,
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

    const { user_id } = event.params;

    if (!user_id) {
      return fail(400, { error: "User ID is required.", action: "unlockUser" });
    }

    // Fetch user to get provider/username for the OBP API
    let user;
    try {
      const endpoint = `/obp/v6.0.0/users/user-id/${encodeURIComponent(user_id)}`;
      user = await obp_requests.get(endpoint, token);
    } catch (e: any) {
      logger.error("Error fetching user for unlock:", e);
      const { message } = extractErrorDetails(e);
      return fail(500, { error: message, action: "unlockUser" });
    }

    if (!user?.provider || !user?.username) {
      return fail(400, { error: "Could not determine provider/username for this user.", action: "unlockUser" });
    }

    try {
      const unlockEndpoint = `/obp/v6.0.0/users/${encodeURIComponent(user.provider)}/${encodeURIComponent(user.username)}/lock-status`;
      const result = await obp_requests.put(unlockEndpoint, {}, token);

      logger.info(`User ${user.username} unlocked successfully`, result);

      throw redirect(303, `/users/${user_id}`);
    } catch (e: any) {
      if (e.status === 303) throw e;
      logger.error("Error unlocking user:", e);
      const { message } = extractErrorDetails(e);
      return fail(500, { error: message, action: "unlockUser" });
    }
  },
};
