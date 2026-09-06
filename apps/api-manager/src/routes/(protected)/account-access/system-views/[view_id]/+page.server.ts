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

const logger = createLogger("SystemViewDetailPageServer");

interface SystemView {
  view_id: string;
  short_name: string;
  description: string;
  metadata_view: string;
  is_public: boolean;
  is_system: boolean;
  is_firehose: boolean;
  alias: string;
  hide_metadata_if_alias_used: boolean;
  can_grant_access_to_views: string[];
  can_revoke_access_to_views: string[];
  allowed_actions: string[];
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  const { view_id } = params;

  if (!view_id) {
    throw error(400, "View ID is required");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for system view detail page");
    return {
      view: null,
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    logger.info("=== FETCHING SYSTEM VIEW DETAIL ===");
    logger.info(`View ID: ${view_id}`);
    const endpoint = `/obp/v6.0.0/management/system-views/${view_id}`;
    logger.info(`Request: ${endpoint}`);

    const response: SystemView = await obp_requests.get(endpoint, accessToken);

    logger.info(`Response: View ${response.short_name}`);
    logger.info("Full view data structure:", JSON.stringify(response, null, 2));

    return {
      view: response,
      hasApiAccess: true,
    };
  } catch (err) {
    logger.error("Error loading system view:", err);

    return {
      view: null,
      hasApiAccess: false,
      error: err instanceof Error ? err.message : "Failed to load system view",
    };
  }
};
