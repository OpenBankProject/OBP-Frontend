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
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";

const logger = createLogger("SystemDynamicEndpointsPageServer");

export const load: PageServerLoad = async ({ locals }) => {
  logger.info("=== System Dynamic Endpoints Page Load Started ===");

  const session = locals.session;

  if (!session?.data?.user) {
    logger.error("No user in session");
    throw error(401, "Unauthorized");
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.error("No access token available");
    throw error(401, "No API access token available");
  }

  logger.info("Access token present, fetching dynamic endpoints");

  try {
    const endpoint = "/obp/v6.0.0/management/dynamic-endpoints";
    logger.info(`Making API request to: ${endpoint}`);

    const endpointsResponse = await obp_requests.get(endpoint, accessToken);

    const endpoints = endpointsResponse.dynamic_endpoints || [];
    logger.info(`Retrieved ${endpoints.length} system dynamic endpoints`);

    return {
      endpoints,
    };
  } catch (err: any) {
    logger.error("Error fetching system dynamic endpoints:", err);
    logger.error("Error details:", {
      message: err?.message,
      status: err?.status,
      statusText: err?.statusText,
      response: err?.response,
    });
    return {
      endpoints: [],
      error:
        err instanceof Error
          ? err.message
          : "Failed to fetch system dynamic endpoints",
    };
  }
};
