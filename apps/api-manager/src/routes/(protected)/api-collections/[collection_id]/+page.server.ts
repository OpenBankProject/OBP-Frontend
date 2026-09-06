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

const logger = createLogger("ApiCollectionDetailPageServer");

interface ApiCollection {
  api_collection_id: string;
  user_id: string;
  api_collection_name: string;
  is_sharable: boolean;
  description: string;
}

interface ApiCollectionEndpoint {
  api_collection_endpoint_id: string;
  api_collection_id: string;
  operation_id: string;
}

interface ApiCollectionEndpointsResponse {
  api_collection_endpoints: ApiCollectionEndpoint[];
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  const { collection_id } = params;

  if (!collection_id) {
    throw error(400, "Collection ID is required");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  // Get user entitlements from session for role checking
  const userEntitlements = (session.data.user as any)?.entitlements?.list || [];

  // Define required roles (API collections are user-owned, no special roles needed)
  const requiredRoles: any[] = [];

  if (!accessToken) {
    logger.warn("No access token available for API collection detail page");
    return {
      collection: null,
      endpoints: [],
      userEntitlements,
      requiredRoles,
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    logger.info("=== FETCHING API COLLECTION DETAIL ===");
    logger.info(`Collection ID: ${collection_id}`);
    const endpoint = `/obp/v6.0.0/my/api-collections/${collection_id}`;
    logger.info(`Request: ${endpoint}`);

    const response: ApiCollection = await obp_requests.get(
      endpoint,
      accessToken,
    );

    logger.info(`Response: Collection ${response.api_collection_name}`);

    // Fetch collection endpoints
    logger.info("=== FETCHING API COLLECTION ENDPOINTS ===");
    const endpointsEndpoint = `/obp/v6.0.0/my/api-collection-ids/${collection_id}/api-collection-endpoints`;
    logger.info(`Request: ${endpointsEndpoint}`);

    let endpoints: ApiCollectionEndpoint[] = [];
    try {
      const endpointsResponse: ApiCollectionEndpointsResponse =
        await obp_requests.get(endpointsEndpoint, accessToken);
      endpoints = endpointsResponse.api_collection_endpoints || [];
      logger.info(`Response: ${endpoints.length} endpoints found`);
    } catch (err) {
      logger.error("Error fetching collection endpoints:", err);
      // Continue without endpoints rather than failing the whole page
    }

    return {
      collection: response,
      endpoints,
      userEntitlements,
      requiredRoles,
      hasApiAccess: true,
    };
  } catch (err) {
    logger.error("Error loading API collection:", err);

    return {
      collection: null,
      endpoints: [],
      userEntitlements,
      requiredRoles,
      hasApiAccess: false,
      error:
        err instanceof Error ? err.message : "Failed to load API collection",
    };
  }
};
