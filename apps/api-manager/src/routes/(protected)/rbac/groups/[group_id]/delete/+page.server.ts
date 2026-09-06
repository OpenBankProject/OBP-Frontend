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

const logger = createLogger("DeleteGroupPageServer");

interface Group {
  group_id: string;
  bank_id: string;
  group_name: string;
  group_description: string;
  is_enabled: boolean;
  list_of_roles?: string[];
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  const { group_id } = params;

  if (!group_id) {
    throw error(400, "Group ID is required");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for delete group page");
    return {
      group: null,
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    logger.info("=== FETCHING GROUP FOR DELETION ===");
    logger.info(`Group ID: ${group_id}`);
    const endpoint = `/obp/v6.0.0/management/groups/${group_id}`;
    logger.info(`Request: ${endpoint}`);

    const response: Group = await obp_requests.get(endpoint, accessToken);

    logger.info(`Response: Group ${response.group_name}`);

    return {
      group: response,
      hasApiAccess: true,
    };
  } catch (err) {
    logger.error("Error loading group:", err);

    return {
      group: null,
      hasApiAccess: false,
      error: err instanceof Error ? err.message : "Failed to load group",
    };
  }
};
