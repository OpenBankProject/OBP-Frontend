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

const logger = createLogger("AddFeaturedCollectionPageServer");

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

interface FeaturedApiCollection {
  api_collection_id: string;
  sort_order: number;
}

interface FeaturedCollectionsResponse {
  featured_api_collections: FeaturedApiCollection[];
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
    logger.warn("No access token available for add featured collection page");
    return {
      collections: [],
      featuredIds: [],
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    // Fetch all collections
    logger.info("=== FETCHING ALL API COLLECTIONS ===");
    const collectionsEndpoint = `/obp/v6.0.0/management/api-collections`;
    logger.info(`Request: ${collectionsEndpoint}`);

    const collectionsResponse: ApiCollectionsResponse = await obp_requests.get(
      collectionsEndpoint,
      accessToken,
    );
    const collections = collectionsResponse.api_collections || [];
    logger.info(`Response: ${collections.length} collections`);

    // Fetch currently featured collections to exclude them
    logger.info("=== FETCHING FEATURED API COLLECTIONS ===");
    const featuredEndpoint = `/obp/v6.0.0/management/api-collections/featured`;
    logger.info(`Request: ${featuredEndpoint}`);

    let featuredIds: string[] = [];
    try {
      const featuredResponse: FeaturedCollectionsResponse =
        await obp_requests.get(featuredEndpoint, accessToken);
      featuredIds = (featuredResponse.featured_api_collections || []).map(
        (f) => f.api_collection_id,
      );
      logger.info(`Response: ${featuredIds.length} featured collections`);
    } catch (err) {
      logger.error("Error fetching featured collections:", err);
      // Continue without featured list
    }

    return {
      collections,
      featuredIds,
      hasApiAccess: true,
    };
  } catch (err) {
    logger.error("Error loading collections:", err);

    return {
      collections: [],
      featuredIds: [],
      hasApiAccess: false,
      error: err instanceof Error ? err.message : "Failed to load collections",
    };
  }
};
