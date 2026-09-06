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
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";

const logger = createLogger("ViewPermissionsPageServer");

interface ViewPermission {
  permission: string;
  category: string;
}

interface ViewPermissionsResponse {
  permissions: ViewPermission[];
}

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for view permissions page");
    return {
      hasApiAccess: false,
      permissionsByCategory: [],
      totalCount: 0,
      error: "No API access token available",
    };
  }

  try {
    const endpoint = `/obp/v6.0.0/management/view-permissions`;
    logger.info(`Fetching view permissions from ${endpoint}`);

    const response: ViewPermissionsResponse = await obp_requests.get(
      endpoint,
      accessToken,
    );

    const categoryMap = new Map<string, string[]>();
    for (const p of response.permissions) {
      const perms = categoryMap.get(p.category) || [];
      perms.push(p.permission);
      categoryMap.set(p.category, perms);
    }

    const permissionsByCategory = Array.from(categoryMap.entries()).map(
      ([category, permissions]) => ({ category, permissions }),
    );

    logger.info(
      `Loaded ${response.permissions.length} permissions in ${permissionsByCategory.length} categories`,
    );

    return {
      hasApiAccess: true,
      permissionsByCategory,
      totalCount: response.permissions.length,
    };
  } catch (err) {
    logger.error("Error loading view permissions:", err);

    return {
      hasApiAccess: true,
      permissionsByCategory: [],
      totalCount: 0,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load view permissions",
    };
  }
};
