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
import { createLogger } from "$lib/utils/logger";
const logger = createLogger("MetricsPageServer");
import type { PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { error } from "@sveltejs/kit";

interface MetricRecord {
  date: string;
  duration: number;
  user_name: string;
  app_name: string;
  developer_email: string;
  consumer_id: string;
  verb: string;
  url: string;
  correlation_id: string;
  implemented_by_partial_function: string;
  implemented_in_version: string;
  user_id?: string;
}

interface MetricsResponse {
  metrics: MetricRecord[];
  count: number;
  error?: string;
}

export const load: PageServerLoad = async ({ locals, url, depends }) => {
  depends("app:metrics");
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for metrics API calls");
    return {
      recentMetrics: null,
      queryMetrics: null,
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    // Build parameters for Recent API Calls from query string or defaults
    const recentParams: Record<string, string> = {
      limit: url.searchParams.get("limit") || "50",
      sort_by: url.searchParams.get("sort_by") || "date",
      direction: url.searchParams.get("direction") || "desc",
    };

    // Add offset if provided
    if (
      url.searchParams.has("offset") &&
      url.searchParams.get("offset")?.trim()
    ) {
      recentParams.offset = url.searchParams.get("offset")!;
    }

    // Add date filters only if provided in query params
    if (
      url.searchParams.has("from_date") &&
      url.searchParams.get("from_date")?.trim()
    ) {
      recentParams.from_date = url.searchParams.get("from_date")!;
    }
    if (
      url.searchParams.has("to_date") &&
      url.searchParams.get("to_date")?.trim()
    ) {
      recentParams.to_date = url.searchParams.get("to_date")!;
    }

    // Add other filters if provided
    if (url.searchParams.has("verb") && url.searchParams.get("verb")?.trim()) {
      recentParams.verb = url.searchParams.get("verb")!;
    }
    if (
      url.searchParams.has("app_name") &&
      url.searchParams.get("app_name")?.trim()
    ) {
      recentParams.app_name = url.searchParams.get("app_name")!;
    }
    if (
      url.searchParams.has("user_name") &&
      url.searchParams.get("user_name")?.trim()
    ) {
      recentParams.user_name = url.searchParams.get("user_name")!;
    }
    if (url.searchParams.has("url") && url.searchParams.get("url")?.trim()) {
      recentParams.url = url.searchParams.get("url")!;
    }
    if (
      url.searchParams.has("consumer_id") &&
      url.searchParams.get("consumer_id")?.trim()
    ) {
      recentParams.consumer_id = url.searchParams.get("consumer_id")!;
    }
    if (url.searchParams.has("anon") && url.searchParams.get("anon")?.trim()) {
      recentParams.anon = url.searchParams.get("anon")!;
    }

    // Fetch recent metrics for real-time panel
    logger.info("=== RECENT API CALLS DEBUG ===");
    logger.info(`🔍 INVALIDATION DETECTED - Server load function called`);
    logger.info(`🌐 Current URL: ${url.pathname}${url.search}`);
    logger.info(`Fetching recent metrics with parameters:`);
    logger.info(`  Parameters: ${JSON.stringify(recentParams, null, 2)}`);
    logger.info(`  🎯 LIMIT VALUE: ${recentParams.limit}`);
    logger.info(`  Access token available: ${!!accessToken}`);
    logger.info(
      `  Access token length: ${accessToken ? accessToken.length : 0}`,
    );

    const recentMetricsData = await fetchMetrics(accessToken, recentParams);

    logger.info(`Recent metrics result:`);
    logger.info(`  📊 Metrics count: ${recentMetricsData?.count || 0}`);
    logger.info(`  ❌ Has error: ${!!recentMetricsData?.error}`);
    logger.info(
      `  🎯 Expected ${recentParams.limit} records, got ${recentMetricsData?.count || 0}`,
    );
    if (recentMetricsData?.error) {
      logger.error(`  Error details: ${recentMetricsData.error}`);
    }
    if (recentMetricsData?.metrics && recentMetricsData.metrics.length > 0) {
      logger.info(
        `  First metric: ${JSON.stringify(recentMetricsData.metrics[0], null, 2)}`,
      );
    }
    logger.info("=== END RECENT API CALLS DEBUG ===");

    // If there are query parameters, also fetch filtered metrics
    let queryMetricsData = null;
    const searchParams = url.searchParams;

    if (
      searchParams.has("from_date") ||
      searchParams.has("to_date") ||
      searchParams.has("user_name") ||
      searchParams.has("app_name") ||
      searchParams.has("verb") ||
      searchParams.has("url")
    ) {
      const queryParams: Record<string, string> = {};

      // Date filters
      if (searchParams.has("from_date"))
        queryParams.from_date = searchParams.get("from_date")!;
      if (searchParams.has("to_date"))
        queryParams.to_date = searchParams.get("to_date")!;

      // Pagination
      queryParams.limit = searchParams.get("limit") || "100";
      queryParams.offset = searchParams.get("offset") || "0";

      // Sorting
      queryParams.sort_by = searchParams.get("sort_by") || "date";
      queryParams.direction = searchParams.get("direction") || "desc";

      // Filters
      if (searchParams.has("consumer_id"))
        queryParams.consumer_id = searchParams.get("consumer_id")!;
      if (searchParams.has("user_id"))
        queryParams.user_id = searchParams.get("user_id")!;
      if (searchParams.has("anon"))
        queryParams.anon = searchParams.get("anon")!;
      if (searchParams.has("url")) queryParams.url = searchParams.get("url")!;
      if (searchParams.has("app_name"))
        queryParams.app_name = searchParams.get("app_name")!;
      if (searchParams.has("implemented_by_partial_function")) {
        queryParams.implemented_by_partial_function = searchParams.get(
          "implemented_by_partial_function",
        )!;
      }
      if (searchParams.has("implemented_in_version")) {
        queryParams.implemented_in_version = searchParams.get(
          "implemented_in_version",
        )!;
      }
      if (searchParams.has("verb"))
        queryParams.verb = searchParams.get("verb")!;
      if (searchParams.has("correlation_id"))
        queryParams.correlation_id = searchParams.get("correlation_id")!;
      if (searchParams.has("duration"))
        queryParams.duration = searchParams.get("duration")!;

      queryMetricsData = await fetchMetrics(accessToken, queryParams);
    }

    return {
      recentMetrics: recentMetricsData,
      queryMetrics: queryMetricsData,
      hasApiAccess: true,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    logger.error("Error loading metrics:", err);

    return {
      recentMetrics: null,
      queryMetrics: null,
      hasApiAccess: false,
      error: err instanceof Error ? err.message : "Failed to load metrics",
    };
  }
};

async function fetchMetrics(
  accessToken: string,
  params: Record<string, string>,
): Promise<MetricsResponse> {
  try {
    // Build query string
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value && String(value).trim() !== "") {
        queryParams.append(key, String(value));
      }
    });

    const endpoint = `/obp/v5.1.0/management/metrics?${queryParams.toString()}`;
    logger.info(`📡 METRICS API CALL START`);
    logger.info(`  Endpoint: ${endpoint}`);
    logger.info(`  Parameters: ${JSON.stringify(params, null, 2)}`);
    logger.info(`  Query string: ${queryParams.toString()}`);
    logger.info(
      `  Access token: ${accessToken ? `${accessToken.substring(0, 20)}...` : "MISSING"}`,
    );

    const response = await obp_requests.get(endpoint, accessToken);

    logger.info(`📡 METRICS API RESPONSE`);
    logger.info(`  Response type: ${typeof response}`);
    logger.info(
      `  Response keys: ${response ? Object.keys(response).join(", ") : "none"}`,
    );
    logger.info(
      `  Has metrics property: ${response?.hasOwnProperty("metrics")}`,
    );
    logger.info(`  Metrics is array: ${Array.isArray(response?.metrics)}`);
    logger.info(
      `  🎯 LIMIT TEST: Requested ${params.limit}, got ${response?.metrics?.length || 0} records`,
    );
    logger.info(`  Raw response: ${JSON.stringify(response, null, 2)}`);

    if (response?.metrics) {
      logger.info(`✅ METRICS FOUND: ${response.metrics.length} records`);
      if (response.metrics.length > 0) {
        logger.info(
          `  Sample metric: ${JSON.stringify(response.metrics[0], null, 2)}`,
        );
      }
      return {
        metrics: response.metrics,
        count: response.metrics.length,
      };
    } else {
      logger.warn("❌ NO METRICS DATA IN RESPONSE");
      logger.warn(`  Response structure: ${JSON.stringify(response, null, 2)}`);
      return {
        metrics: [],
        count: 0,
        error: "No metrics data found in API response",
      };
    }
  } catch (err) {
    logger.error("🚨 ERROR FETCHING METRICS:");
    logger.error(`  Error type: ${err?.constructor?.name}`);
    logger.error(
      `  Error message: ${err instanceof Error ? err.message : String(err)}`,
    );
    logger.error(
      `  Error stack: ${err instanceof Error ? err.stack : "No stack trace"}`,
    );

    return {
      metrics: [],
      count: 0,
      error: err instanceof Error ? err.message : "Failed to fetch metrics",
    };
  }
}

// Helper function to validate and format date
function formatDateForAPI(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// Helper function to get default date range (last hour)
function getDefaultDateRange() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  return {
    from_date: oneHourAgo.toISOString(),
    to_date: now.toISOString(),
  };
}
