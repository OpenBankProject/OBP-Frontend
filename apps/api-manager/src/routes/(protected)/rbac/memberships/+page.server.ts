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

const logger = createLogger("MembershipsPageServer");

interface Group {
  group_id: string;
  bank_id: string;
  group_name: string;
  group_description: string;
  is_enabled: boolean;
  list_of_roles?: string[];
}

interface GroupsResponse {
  groups: Group[];
}

interface Entitlement {
  entitlement_id: string;
  role_name: string;
  bank_id: string;
  user_id?: string;
  username?: string;
}

interface GroupWithEntitlements extends Group {
  entitlements: Entitlement[];
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
    logger.warn("No access token available for memberships page");
    return {
      groupsWithEntitlements: [],
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    logger.info("=== FETCHING GROUPS AND THEIR ENTITLEMENTS ===");

    // Step 1: Get all groups
    const groupsEndpoint = `/obp/v6.0.0/management/groups`;
    logger.info(`Fetching groups: ${groupsEndpoint}`);
    const groupsResponse: GroupsResponse = await obp_requests.get(
      groupsEndpoint,
      accessToken,
    );

    const groups = groupsResponse.groups || [];
    logger.info(`Found ${groups.length} groups`);

    // Step 2: For each group, fetch its entitlements
    const groupsWithEntitlements: GroupWithEntitlements[] = [];

    for (const group of groups) {
      try {
        const entitlementsEndpoint = `/obp/v6.0.0/management/groups/${group.group_id}/entitlements`;
        logger.info(
          `Fetching entitlements for group ${group.group_id}: ${entitlementsEndpoint}`,
        );

        const entitlementsResponse = await obp_requests.get(
          entitlementsEndpoint,
          accessToken,
        );

        logger.info(
          `Raw entitlements response for group ${group.group_id}:`,
          JSON.stringify(entitlementsResponse, null, 2),
        );
        logger.info(
          `Response keys: ${Object.keys(entitlementsResponse).join(", ")}`,
        );

        const entitlements = entitlementsResponse.entitlements || [];
        logger.info(
          `Group ${group.group_id} (${group.group_name}) has ${entitlements.length} entitlements`,
        );

        groupsWithEntitlements.push({
          ...group,
          entitlements: entitlements,
        });
      } catch (err) {
        logger.error(
          `Error fetching entitlements for group ${group.group_id}:`,
          err,
        );
        // Still add the group but with empty entitlements
        groupsWithEntitlements.push({
          ...group,
          entitlements: [],
        });
      }
    }

    logger.info(
      `Successfully fetched ${groupsWithEntitlements.length} groups with their entitlements`,
    );

    return {
      groupsWithEntitlements,
      hasApiAccess: true,
    };
  } catch (err) {
    logger.error("Error loading groups and entitlements:", err);

    return {
      groupsWithEntitlements: [],
      hasApiAccess: false,
      error: err instanceof Error ? err.message : "Failed to load data",
    };
  }
};
