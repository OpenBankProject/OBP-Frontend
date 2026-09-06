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
const logger = createLogger("ResetPasswordPageServer");
import type { PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { extractErrorDetails } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { error, fail } from "@sveltejs/kit";
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
    logger.warn("No access token available for reset-password page");
    return {
      user: null,
      user_id,
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  let user = null;
  try {
    const endpoint = `/obp/v6.0.0/users/user-id/${encodeURIComponent(user_id)}`;
    user = await obp_requests.get(endpoint, accessToken);
  } catch (err) {
    logger.error(
      `Error fetching user details: ${err instanceof Error ? err.message : String(err)}`,
    );
    return {
      user: null,
      user_id,
      hasApiAccess: false,
      error: err instanceof Error ? err.message : "Failed to load user details",
    };
  }

  return {
    user,
    user_id,
    hasApiAccess: true,
  };
};

export const actions = {
  sendResetPasswordEmail: async (event: RequestEvent) => {
    const session = event.locals.session;

    if (!session?.data?.user) {
      return fail(401, { error: "Unauthorized", action: "sendResetPasswordEmail" });
    }

    const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
    const token = sessionOAuth?.accessToken;

    if (!token) {
      return fail(401, {
        error: "Unauthorized: No access token found in session.",
        action: "sendResetPasswordEmail",
      });
    }

    const { user_id } = event.params;

    if (!user_id) {
      return fail(400, { error: "User ID is required.", action: "sendResetPasswordEmail" });
    }

    let user;
    try {
      const endpoint = `/obp/v6.0.0/users/user-id/${encodeURIComponent(user_id)}`;
      user = await obp_requests.get(endpoint, token);
    } catch (e: any) {
      logger.error("Error fetching user for password reset:", e);
      const { message } = extractErrorDetails(e);
      return fail(500, { error: message, action: "sendResetPasswordEmail" });
    }

    if (!user?.user_id || !user?.username || !user?.email) {
      return fail(400, {
        error: "Could not determine user_id, username and email for this user.",
        action: "sendResetPasswordEmail",
      });
    }

    try {
      const endpoint = `/obp/v6.0.0/management/user/reset-password-url`;
      const result = await obp_requests.post(
        endpoint,
        {
          user_id: user.user_id,
          username: user.username,
          email: user.email,
        },
        token,
      );

      logger.info(
        `Password reset email requested for ${user.username} <${user.email}>`,
      );

      return {
        success: true,
        action: "sendResetPasswordEmail",
        sentTo: result.to,
        username: user.username,
        apiStatus: result.status,
      };
    } catch (e: any) {
      logger.error("Error requesting password reset email:", e);
      const { message } = extractErrorDetails(e);
      return fail(500, { error: message, action: "sendResetPasswordEmail" });
    }
  },
};
