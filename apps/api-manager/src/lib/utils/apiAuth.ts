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
import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from "@obp/shared/utils";

const logger = createLogger("APIAuth");

export interface AuthCheckResult {
  authenticated: boolean;
  accessToken?: string;
  error?: Response;
}

/**
 * Checks if the request has a valid authenticated session with an access token.
 * Returns an object with authentication status and either the access token or an error response.
 *
 * @param locals - The request locals containing the session
 * @returns AuthCheckResult with authentication status and access token or error response
 *
 * @example
 * ```typescript
 * export const GET: RequestHandler = async ({ locals }) => {
 *   const auth = checkAPIAuth(locals);
 *   if (!auth.authenticated) {
 *     return auth.error!;
 *   }
 *
 *   // Use auth.accessToken for API calls
 *   const response = await obp_requests.get(endpoint, auth.accessToken);
 *   return json(response);
 * };
 * ```
 */
export function checkAPIAuth(locals: App.Locals): AuthCheckResult {
  const session = locals.session;

  // Check if session exists
  if (!session) {
    logger.warn("No session found in request");
    return {
      authenticated: false,
      error: json(
        { error: "Unauthorized - No session" },
        { status: 401 }
      ),
    };
  }

  // Check if user exists in session
  if (!session.data?.user) {
    logger.warn("No user in session");
    return {
      authenticated: false,
      error: json(
        { error: "Unauthorized - No user in session" },
        { status: 401 }
      ),
    };
  }

  // Get OAuth data from session
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  if (!sessionOAuth) {
    logger.warn("No OAuth data in session for user:", session.data.user.email);
    return {
      authenticated: false,
      error: json(
        { error: "Unauthorized - No OAuth data" },
        { status: 401 }
      ),
    };
  }

  // Check if access token exists
  const accessToken = sessionOAuth.accessToken;
  if (!accessToken) {
    logger.warn("No access token available for user:", session.data.user.email);
    return {
      authenticated: false,
      error: json(
        { error: "Unauthorized - No access token" },
        { status: 401 }
      ),
    };
  }

  logger.debug("Authentication successful for user:", session.data.user.email);
  return {
    authenticated: true,
    accessToken,
  };
}

/**
 * Middleware-style authentication check that throws/returns error response if not authenticated.
 * Use this for a more concise pattern in API routes.
 *
 * @param locals - The request locals containing the session
 * @returns The access token if authenticated
 * @throws Response with 401 status if not authenticated
 *
 * @example
 * ```typescript
 * export const GET: RequestHandler = async ({ locals }) => {
 *   const accessToken = requireAPIAuth(locals);
 *
 *   const response = await obp_requests.get(endpoint, accessToken);
 *   return json(response);
 * };
 * ```
 */
export function requireAPIAuth(locals: App.Locals): string {
  const auth = checkAPIAuth(locals);
  if (!auth.authenticated) {
    throw auth.error;
  }
  return auth.accessToken!;
}

/**
 * Optional: Get user info from session if authenticated
 *
 * @param locals - The request locals containing the session
 * @returns User object or null if not authenticated
 */
export function getAuthenticatedUser(locals: App.Locals) {
  const session = locals.session;
  return session?.data?.user || null;
}
