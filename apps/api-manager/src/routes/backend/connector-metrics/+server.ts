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
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("ConnectorMetricsAPI");

export const GET: RequestHandler = async ({ locals, url }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for connector metrics API call");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    // Build query parameters from URL search params
    const queryParams = new URLSearchParams();

    // Supported filters for connector metrics
    const supportedParams = [
      "from_date",
      "to_date",
      "limit",
      "offset",
      "connector_name",
      "function_name",
      "correlation_id",
    ];

    supportedParams.forEach((param) => {
      const value = url.searchParams.get(param);
      if (value && value.trim() !== "") {
        queryParams.append(param, value);
      }
    });

    // Set defaults if not provided
    if (!queryParams.has("limit")) {
      queryParams.set("limit", "50");
    }

    logger.info("=== CONNECTOR METRICS API CALL ===");
    const endpoint = `/obp/v6.0.0/management/connector/metrics?${queryParams.toString()}`;
    logger.info(`Request: ${endpoint}`);

    const response = await obp_requests.get(endpoint, accessToken);

    logger.info(`Response: ${response?.metrics?.length || 0} connector metrics`);

    return json({
      metrics: response.metrics || [],
      count: response.metrics?.length || 0,
    });
  } catch (err) {
    logger.error("Error fetching connector metrics:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
