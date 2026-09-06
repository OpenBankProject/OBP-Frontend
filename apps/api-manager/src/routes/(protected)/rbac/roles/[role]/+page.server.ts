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
const logger = createLogger("RoleDetailPageServer");
import type { PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { error } from "@sveltejs/kit";
import { resourceDocsCache } from "$lib/stores/resourceDocsCache";

interface Entitlement {
  entitlement_id: string;
  role_name: string;
  bank_id: string;
  user_id: string;
  username: string;
}

interface EntitlementsResponse {
  list: Entitlement[];
}

interface ResourceDoc {
  operation_id: string;
  request_verb: string;
  request_url: string;
  summary: string;
  description?: string;
  markdown_description?: string;
  description_html?: string;
}

interface ResourceDocsResponse {
  resource_docs: ResourceDoc[];
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const session = locals.session;
  const roleName = params.role;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for role detail API calls");
    return {
      roleName,
      entitlements: [],
      users: [],
      endpoints: [],
      requiresBankId: false,
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    logger.info("=== ROLE DETAIL API CALLS ===");
    logger.info(`Role: ${roleName}`);

    // 1. Fetch role metadata directly from OBP API to get requires_bank_id
    let requiresBankId = false;
    try {
      const rolesEndpoint = `/obp/v6.0.0/roles`;
      logger.info(`Fetching roles metadata: ${rolesEndpoint}`);
      const rolesResponse = await obp_requests.get(rolesEndpoint, accessToken);
      const roles = rolesResponse.roles || [];
      const roleMetadata = roles.find((r: any) => r.role === roleName);
      requiresBankId = roleMetadata?.requires_bank_id ?? false;
      logger.info(`Role requires_bank_id: ${requiresBankId}`);
    } catch (err) {
      logger.warn(`Failed to fetch role metadata: ${err}`);
    }

    // 2. Fetch entitlements for this role
    const entitlementsEndpoint = `/obp/v6.0.0/entitlements?role=${encodeURIComponent(roleName)}`;
    logger.info(`Fetching entitlements: ${entitlementsEndpoint}`);

    const entitlementsResponse: EntitlementsResponse = await obp_requests.get(
      entitlementsEndpoint,
      accessToken,
    );

    const allEntitlements = entitlementsResponse.list || [];
    logger.info(`Found ${allEntitlements.length} entitlements`);

    // TODO: Filter out entitlements with null/empty usernames
    // This should be fixed at the API level - the entitlements endpoint should always return valid usernames
    const entitlements = allEntitlements.filter(
      (entitlement) =>
        entitlement.username && entitlement.username.trim() !== "",
    );
    logger.info(
      `Filtered to ${entitlements.length} entitlements with valid usernames (removed ${allEntitlements.length - entitlements.length})`,
    );

    // 3. Fetch resource docs from cache to find endpoints that require this role
    logger.info(`Fetching resource docs (from cache if available) for role`);
    const allResourceDocs = await (resourceDocsCache as any).fetchResourceDocs(
      accessToken,
    );

    // Filter resource docs that mention this role in their required roles
    const endpointsForRole = allResourceDocs.filter((doc: any) => {
      const roles = doc.roles || [];
      return roles.some((r: any) => r.role === roleName);
    });

    logger.info(`Found ${endpointsForRole.length} endpoints for this role`);

    return {
      roleName,
      entitlements,
      endpoints: endpointsForRole,
      requiresBankId,
      hasApiAccess: true,
    };
  } catch (err) {
    logger.error("Error loading role details:", err);

    return {
      roleName,
      entitlements: [],
      endpoints: [],
      requiresBankId: false,
      hasApiAccess: false,
      error: err instanceof Error ? err.message : "Failed to load role details",
    };
  }
};
