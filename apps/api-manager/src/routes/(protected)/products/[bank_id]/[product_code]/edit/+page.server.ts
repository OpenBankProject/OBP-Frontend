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

const logger = createLogger("EditProductPageServer");

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

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for edit product page");
    return {
      product: null,
      collections: [],
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  const bankId = params.bank_id;
  const productCode = params.product_code;

  try {
    logger.info(`=== FETCHING PRODUCT AND COLLECTIONS FOR EDIT ===`);

    // Fetch product and collections in parallel
    const [product, collectionsResponse] = await Promise.all([
      obp_requests.get(
        `/obp/v6.0.0/banks/${bankId}/api-products/${productCode}`,
        accessToken,
      ),
      obp_requests.get(
        `/obp/v6.0.0/my/api-collections`,
        accessToken,
      ) as Promise<ApiCollectionsResponse>,
    ]);

    logger.info(`Product fetched, ${collectionsResponse.api_collections?.length || 0} collections`);

    return {
      product,
      collections: collectionsResponse.api_collections || [],
      hasApiAccess: true,
    };
  } catch (err) {
    logger.error("Error loading product/collections for edit:", err);

    return {
      product: null,
      collections: [],
      hasApiAccess: false,
      error:
        err instanceof Error ? err.message : "Failed to load product data",
    };
  }
};
