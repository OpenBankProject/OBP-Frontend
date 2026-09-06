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

const logger = createLogger("CreateApiCollectionPageServer");

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  // Get user entitlements from session for role checking
  const userEntitlements = (session.data.user as any)?.entitlements?.list || [];

  // No special roles required for creating personal API collections
  const requiredRoles: any[] = [];

  if (!accessToken) {
    logger.warn("No access token available for create API collection page");
    return {
      userEntitlements,
      requiredRoles,
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  return {
    userEntitlements,
    requiredRoles,
    hasApiAccess: true,
  };
};
