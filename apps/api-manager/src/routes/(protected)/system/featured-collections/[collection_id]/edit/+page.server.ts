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

const logger = createLogger("EditFeaturedCollectionPageServer");

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

  if (!accessToken) {
    logger.warn("No access token available for edit featured collection page");
    return {
      featured: null,
      collection: null,
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    // Fetch featured collections to find the one we're editing
    logger.info("=== FETCHING FEATURED API COLLECTIONS ===");
    const featuredEndpoint = `/obp/v6.0.0/management/api-collections/featured`;
    logger.info(`Request: ${featuredEndpoint}`);

    const featuredResponse: FeaturedCollectionsResponse = await obp_requests.get(
      featuredEndpoint,
      accessToken,
    );

    const featured = (featuredResponse.featured_api_collections || []).find(
      (f) => f.api_collection_id === collection_id,
    );

    if (!featured) {
      return {
        featured: null,
        collection: null,
        hasApiAccess: true,
        error: "Featured collection not found",
      };
    }

    logger.info(`Found featured collection with sort_order: ${featured.sort_order}`);

    // Fetch collection details
    logger.info("=== FETCHING COLLECTION DETAILS ===");
    const collectionsEndpoint = `/obp/v6.0.0/management/api-collections`;
    logger.info(`Request: ${collectionsEndpoint}`);

    let collection: ApiCollection | null = null;
    try {
      const collectionsResponse: ApiCollectionsResponse = await obp_requests.get(
        collectionsEndpoint,
        accessToken,
      );
      collection =
        (collectionsResponse.api_collections || []).find(
          (c) => c.api_collection_id === collection_id,
        ) || null;
    } catch (err) {
      logger.error("Error fetching collection details:", err);
    }

    return {
      featured,
      collection,
      hasApiAccess: true,
    };
  } catch (err) {
    logger.error("Error loading featured collection:", err);

    return {
      featured: null,
      collection: null,
      hasApiAccess: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load featured collection",
    };
  }
};
