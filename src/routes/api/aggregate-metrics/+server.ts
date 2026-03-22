import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { checkAPIAuth } from "$lib/utils/apiAuth";
import { createLogger } from "$lib/utils/logger";
import { env } from "$env/dynamic/public";

const logger = createLogger("AggregateMetricsAPI");

export const GET: RequestHandler = async ({ url, locals }) => {
  const auth = checkAPIAuth(locals);
  if (!auth.authenticated) {
    return auth.error!;
  }

  const accessToken = auth.accessToken!;

  try {
    // Get all query parameters from the request
    const queryString = url.searchParams.toString();

    // Build the OBP API endpoint with the query string
    const endpoint = `/obp/v6.0.0/management/aggregate-metrics?${queryString}`;

    logger.info("=== AGGREGATE METRICS API CALL ===");
    logger.info(`Request: ${endpoint}`);

    // Make the fetch call directly to capture headers
    const obpResponse = await fetch(
      `${env.PUBLIC_OBP_BASE_URL || ""}${endpoint}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    // Extract correlation ID from response headers
    const correlationId =
      obpResponse.headers.get("X-Correlation-Id") ||
      obpResponse.headers.get("correlation-id") ||
      obpResponse.headers.get("x-correlation-id") ||
      "N/A";

    const response = await obpResponse.json();

    logger.info("Raw response from OBP API:");
    logger.info(JSON.stringify(response, null, 2));
    logger.info(`Correlation ID: ${correlationId}`);

    // Aggregate metrics returns an array with a single object containing count, average_response_time, min, max
    const metrics = Array.isArray(response) ? response[0] : response;
    if (metrics && metrics.count !== undefined) {
      logger.info(
        `Response: count=${metrics.count}, avg=${metrics.average_response_time}ms`,
      );

      const responseData = json({
        count: metrics.count,
        average_response_time: metrics.average_response_time,
        minimum_response_time: metrics.minimum_response_time,
        maximum_response_time: metrics.maximum_response_time,
      });

      // Add correlation ID to response headers
      responseData.headers.set("X-Correlation-Id", correlationId);

      return responseData;
    } else {
      logger.warn("NO AGGREGATE METRICS DATA IN RESPONSE");
      return json({
        count: 0,
        average_response_time: 0,
        minimum_response_time: 0,
        maximum_response_time: 0,
        error: "No aggregate metrics data found in API response",
      });
    }
  } catch (err) {
    logger.error("ERROR FETCHING AGGREGATE METRICS:");
    logger.error(`  Error type: ${err?.constructor?.name}`);
    logger.error(
      `  Error message: ${err instanceof Error ? err.message : String(err)}`,
    );

    return json(
      {
        count: 0,
        average_response_time: 0,
        minimum_response_time: 0,
        maximum_response_time: 0,
        error:
          err instanceof Error
            ? err.message
            : "Failed to fetch aggregate metrics",
      },
      { status: 500 },
    );
  }
};
