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

const logger = createLogger("CreateMembershipPageServer");

interface User {
  user_id: string;
  username: string;
  email: string;
}

interface Group {
  group_id: string;
  bank_id: string;
  group_name: string;
  group_description: string;
  is_enabled: boolean;
  list_of_roles?: string[];
}

interface UsersResponse {
  users: User[];
}

interface GroupsResponse {
  groups: Group[];
}

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for create membership page");
    return {
      users: [],
      groups: [],
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    logger.info("=== FETCHING USERS AND GROUPS FOR CREATE MEMBERSHIP PAGE ===");

    // Fetch users
    const usersEndpoint = `/obp/v6.0.0/users`;
    logger.info(`Fetching users: ${usersEndpoint}`);
    const usersResponse: UsersResponse = await obp_requests.get(
      usersEndpoint,
      accessToken,
    );

    // Fetch groups
    const groupsEndpoint = `/obp/v6.0.0/management/groups`;
    logger.info(`Fetching groups: ${groupsEndpoint}`);
    const groupsResponse: GroupsResponse = await obp_requests.get(
      groupsEndpoint,
      accessToken,
    );

    logger.info(
      `Response: ${usersResponse.users?.length || 0} users, ${groupsResponse.groups?.length || 0} groups`,
    );

    return {
      users: usersResponse.users || [],
      groups: groupsResponse.groups || [],
      hasApiAccess: true,
    };
  } catch (err) {
    logger.error("Error loading data:", err);

    return {
      users: [],
      groups: [],
      hasApiAccess: false,
      error: err instanceof Error ? err.message : "Failed to load data",
    };
  }
};
