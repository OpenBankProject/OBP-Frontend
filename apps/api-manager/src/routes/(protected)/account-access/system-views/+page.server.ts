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

const logger = createLogger("SystemViewsPageServer");

interface SystemView {
  view_id: string;
  short_name: string;
  description: string;
  is_public: boolean;
  alias?: string;
  hide_metadata_if_alias_used?: boolean;
  bank_id?: string;
  account_id?: string;
}

interface ViewsResponse {
  views: SystemView[];
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
    logger.warn("No access token available for system views page");
    return {
      views: [],
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    logger.info("=== FETCHING SYSTEM VIEWS ===");
    const endpoint = `/obp/v6.0.0/management/system-views`;
    logger.info(`Request: ${endpoint}`);

    const response: ViewsResponse = await obp_requests.get(
      endpoint,
      accessToken,
    );

    logger.info(`Response received with ${response.views?.length || 0} views`);

    if (response.views) {
      logger.info(`First view sample: ${JSON.stringify(response.views[0])}`);
    }

    return {
      views: response.views || [],
      hasApiAccess: true,
    };
  } catch (err) {
    logger.error("Error loading system views:", err);
    logger.error(
      `Error message: ${err instanceof Error ? err.message : String(err)}`,
    );

    return {
      views: [],
      hasApiAccess: true,
      error: err instanceof Error ? err.message : "Failed to load system views",
    };
  }
};
