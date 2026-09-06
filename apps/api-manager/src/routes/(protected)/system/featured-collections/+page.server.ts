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

const logger = createLogger("FeaturedCollectionsPageServer");

interface FeaturedApiCollection {
  api_collection_id: string;
  sort_order: number;
}

interface FeaturedCollectionsResponse {
  featured_api_collections: FeaturedApiCollection[];
}

interface ApiCollection {
  api_collection_id: string;
  user_id: string;
  api_collection_name: string;
  is_sharable: boolean;
  description: string;
}

interface ApiCollectionsResponse {
  api_collections: ApiCollection[];
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
    logger.warn("No access token available for featured collections page");
    return {
      featuredCollections: [],
      collectionsMap: {},
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    logger.info("=== FETCHING FEATURED API COLLECTIONS ===");
    const endpoint = `/obp/v6.0.0/management/api-collections/featured`;
    logger.info(`Request: ${endpoint}`);

    const response: FeaturedCollectionsResponse = await obp_requests.get(
      endpoint,
      accessToken,
    );

    const featuredCollections = response.featured_api_collections || [];
    logger.info(`Response: ${featuredCollections.length} featured collections`);

    // Fetch all collections to get names and details
    logger.info("=== FETCHING ALL API COLLECTIONS FOR NAMES ===");
    const allCollectionsEndpoint = `/obp/v6.0.0/management/api-collections`;
    logger.info(`Request: ${allCollectionsEndpoint}`);

    let collectionsMap: Record<string, ApiCollection> = {};
    try {
      const allCollectionsResponse: ApiCollectionsResponse =
        await obp_requests.get(allCollectionsEndpoint, accessToken);
      const allCollections = allCollectionsResponse.api_collections || [];
      logger.info(`Response: ${allCollections.length} total collections`);

      // Create a map for easy lookup
      collectionsMap = allCollections.reduce(
        (acc, collection) => {
          acc[collection.api_collection_id] = collection;
          return acc;
        },
        {} as Record<string, ApiCollection>,
      );
    } catch (err) {
      logger.error("Error fetching all collections:", err);
      // Continue without collection details
    }

    return {
      featuredCollections,
      collectionsMap,
      hasApiAccess: true,
    };
  } catch (err) {
    logger.error("Error loading featured collections:", err);

    return {
      featuredCollections: [],
      collectionsMap: {},
      hasApiAccess: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load featured collections",
    };
  }
};
