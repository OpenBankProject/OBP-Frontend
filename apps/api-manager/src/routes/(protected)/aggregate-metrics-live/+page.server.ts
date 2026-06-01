import { createLogger } from "@obp/shared/utils";
const logger = createLogger("MetricsPageServer");
import type { PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { error } from "@sveltejs/kit";

interface MetricRecord {
  date: string;
  duration: number;
  username: string;
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
    // Build parameters from query string or defaults
    const params: Record<string, string> = {
      limit: url.searchParams.get("limit") || "50",
      sort_by: url.searchParams.get("sort_by") || "date",
      direction: url.searchParams.get("direction") || "desc",
    };

    // Add offset if provided
    if (
      url.searchParams.has("offset") &&
      url.searchParams.get("offset")?.trim()
    ) {
      params.offset = url.searchParams.get("offset")!;
    }

    // Add date filters only if provided in query params
    if (
      url.searchParams.has("from_date") &&
      url.searchParams.get("from_date")?.trim()
    ) {
      params.from_date = url.searchParams.get("from_date")!;
    }
    if (
      url.searchParams.has("to_date") &&
      url.searchParams.get("to_date")?.trim()
    ) {
      params.to_date = url.searchParams.get("to_date")!;
    }

    // Add all filter parameters if provided
    if (url.searchParams.has("verb") && url.searchParams.get("verb")?.trim()) {
      params.verb = url.searchParams.get("verb")!;
    }
    if (
      url.searchParams.has("app_name") &&
      url.searchParams.get("app_name")?.trim()
    ) {
      params.app_name = url.searchParams.get("app_name")!;
    }
    if (
      url.searchParams.has("username") &&
      url.searchParams.get("username")?.trim()
    ) {
      params.username = url.searchParams.get("username")!;
    }
    if (url.searchParams.has("url") && url.searchParams.get("url")?.trim()) {
      params.url = url.searchParams.get("url")!;
    }
    if (
      url.searchParams.has("consumer_id") &&
      url.searchParams.get("consumer_id")?.trim()
    ) {
      params.consumer_id = url.searchParams.get("consumer_id")!;
    }
    if (
      url.searchParams.has("user_id") &&
      url.searchParams.get("user_id")?.trim()
    ) {
      params.user_id = url.searchParams.get("user_id")!;
    }
    if (url.searchParams.has("anon") && url.searchParams.get("anon")?.trim()) {
      params.anon = url.searchParams.get("anon")!;
    }
    if (
      url.searchParams.has("implemented_by_partial_function") &&
      url.searchParams.get("implemented_by_partial_function")?.trim()
    ) {
      params.implemented_by_partial_function = url.searchParams.get(
        "implemented_by_partial_function",
      )!;
    }
    if (
      url.searchParams.has("implemented_in_version") &&
      url.searchParams.get("implemented_in_version")?.trim()
    ) {
      params.implemented_in_version = url.searchParams.get(
        "implemented_in_version",
      )!;
    }
    if (
      url.searchParams.has("correlation_id") &&
      url.searchParams.get("correlation_id")?.trim()
    ) {
      params.correlation_id = url.searchParams.get("correlation_id")!;
    }
    if (
      url.searchParams.has("duration") &&
      url.searchParams.get("duration")?.trim()
    ) {
      params.duration = url.searchParams.get("duration")!;
    }

    // Fetch metrics with the constructed parameters
    logger.info("=== METRICS API CALL ===");
    logger.info(`Request: ${JSON.stringify(params, null, 2)}`);

    const metricsData = await fetchMetrics(accessToken, params);

    logger.info(`Response: ${metricsData?.count || 0} records`);
    if (metricsData?.error) {
      logger.error(`Error: ${metricsData.error}`);
    }

    return {
      metrics: metricsData,
      hasApiAccess: true,
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    logger.error("Error loading metrics:", err);

    return {
      metrics: null,
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

    const endpoint = `/obp/v6.0.0/management/metrics?${queryParams.toString()}`;
    logger.info(`METRICS API CALL START`);
    logger.info(`  Endpoint: ${endpoint}`);
    logger.info(`  Parameters: ${JSON.stringify(params, null, 2)}`);
    logger.info(`  Query string: ${queryParams.toString()}`);
    logger.info(
      `  Access token: ${accessToken ? `${accessToken.substring(0, 20)}...` : "MISSING"}`,
    );

    const response = await obp_requests.get(endpoint, accessToken);

    logger.info(`METRICS API RESPONSE`);
    logger.info(`  Response type: ${typeof response}`);
    logger.info(
      `  Response keys: ${response ? Object.keys(response).join(", ") : "none"}`,
    );
    logger.info(
      `  Has metrics property: ${response?.hasOwnProperty("metrics")}`,
    );
    logger.info(`  Metrics is array: ${Array.isArray(response?.metrics)}`);
    logger.info(
      `  LIMIT TEST: Requested ${params.limit}, got ${response?.metrics?.length || 0} records`,
    );
    if (response?.metrics) {
      return {
        metrics: response.metrics,
        count: response.metrics.length,
      };
    } else {
      logger.warn("NO METRICS DATA IN RESPONSE");
      return {
        metrics: [],
        count: 0,
        error: "No metrics data found in API response",
      };
    }
  } catch (err) {
    logger.error("ERROR FETCHING METRICS:");
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
