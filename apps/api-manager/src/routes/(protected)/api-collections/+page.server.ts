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

const logger = createLogger("ApiCollectionsPageServer");

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
    logger.warn("No access token available for API collections page");
    return {
      collections: [],
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    logger.info("=== FETCHING MY API COLLECTIONS ===");
    const endpoint = `/obp/v6.0.0/my/api-collections`;
    logger.info(`Request: ${endpoint}`);

    const response: ApiCollectionsResponse = await obp_requests.get(
      endpoint,
      accessToken,
    );

    logger.info(
      `Response: ${response.api_collections?.length || 0} collections`,
    );

    return {
      collections: response.api_collections || [],
      hasApiAccess: true,
    };
  } catch (err) {
    logger.error("Error loading API collections:", err);

    return {
      collections: [],
      hasApiAccess: false,
      error:
        err instanceof Error ? err.message : "Failed to load API collections",
    };
  }
};
