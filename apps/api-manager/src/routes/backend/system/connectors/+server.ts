import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("ConnectorsAPI");

// GET - Fetch all available connector names
export const GET: RequestHandler = async ({ locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    logger.error("No user in session - returning 401");
    return json(
      { message: "Unauthorized - No user in session", code: 401 }, { status: 401 },
    );
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.error("No access token available for connectors API call");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    logger.info("=== CONNECTORS API CALL ===");
    const endpoint = `/obp/v6.0.0/system/connectors`;
    logger.info(`Request: ${endpoint}`);

    const response = await obp_requests.get(endpoint, accessToken);

    logger.info("Connectors fetched successfully");

    // Filter for connectors available in method routing and extract just the names
    const connectors = response?.connectors || [];
    const availableConnectors = connectors
      .filter((c: { connector_name: string; is_available_in_method_routing: boolean }) =>
        c.is_available_in_method_routing === true
      )
      .map((c: { connector_name: string }) => c.connector_name);

    logger.info(`Response: ${availableConnectors.length} connectors available for method routing`);

    return json(availableConnectors);
  } catch (err) {
    logger.error("ERROR FETCHING CONNECTORS:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
