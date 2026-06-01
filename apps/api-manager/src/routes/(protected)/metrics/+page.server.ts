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
  consent_reference_id?: string;
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
    if (
      url.searchParams.has("include_app_names") &&
      url.searchParams.get("include_app_names")?.trim()
    ) {
      params.include_app_names = url.searchParams.get("include_app_names")!;
    }
    if (
      url.searchParams.has("http_status_code") &&
      url.searchParams.get("http_status_code")?.trim()
    ) {
      params.http_status_code = url.searchParams.get("http_status_code")!;
    }
    if (
      url.searchParams.has("consent_reference_id") &&
      url.searchParams.get("consent_reference_id")?.trim()
    ) {
      params.consent_reference_id = url.searchParams.get("consent_reference_id")!;
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
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && String(value).trim() !== "") {
      queryParams.append(key, String(value));
    }
  });

  const endpoint = `/obp/v6.0.0/management/metrics?${queryParams.toString()}`;
  logger.info(`Fetching: ${endpoint}`);

  const response = await obp_requests.getResponse(endpoint, accessToken);
  const data = await response.json();

  if (data?.metrics) {
    return {
      metrics: data.metrics,
      count: data.metrics.length,
    };
  }

  // Return whatever OBP sent back as the error
  return {
    metrics: [],
    count: 0,
    error: JSON.stringify(data),
  };
}
