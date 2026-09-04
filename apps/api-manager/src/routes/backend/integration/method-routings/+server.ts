import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from "@obp/shared/utils";

const logger = createLogger("MethodRoutingsAPI");

// GET - Fetch all method routings
export const GET: RequestHandler = async ({ locals, url }) => {
  const session = locals.session;

  logger.info("=== METHOD ROUTINGS GET API CALL ===");
  logger.info(`Session exists: ${!!session}`);
  logger.info(`User exists: ${!!session?.data?.user}`);

  if (!session?.data?.user) {
    logger.error("No user in session - returning 401");
    return json(
      { message: "Unauthorized - No user in session", code: 401 }, { status: 401 },
    );
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.error("No access token available for method routings API call");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const queryString = url.searchParams.toString();
    const endpoint = `/obp/v3.1.0/management/method_routings${queryString ? `?${queryString}` : ""}`;
    logger.info(`Request: ${endpoint}`);

    let response;
    try {
      response = await obp_requests.get(endpoint, accessToken);
    } catch (firstErr: any) {
      const errMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      if (errMsg.includes("JOSE") || errMsg.includes("JWK")) {
        logger.warn(`Transient JOSE error, retrying: ${errMsg}`);
        response = await obp_requests.get(endpoint, accessToken);
      } else {
        throw firstErr;
      }
    }

    logger.info("Method routings fetched successfully");
    logger.info("Response type:", typeof response);
    logger.info(
      "Response keys:",
      response ? Object.keys(response).join(", ") : "none",
    );
    logger.debug("Full response:", JSON.stringify(response, null, 2));

    return json(response);
  } catch (err: any) {
    logger.error("ERROR FETCHING METHOD ROUTINGS:");
    logger.error(`  Error type: ${err?.constructor?.name}`);
    logger.error(
      `  Error message: ${err instanceof Error ? err.message : String(err)}`,
    );
    logger.error(
      `  Error stack: ${err instanceof Error ? err.stack : "No stack"}`,
    );

    if (err.response) {
      logger.error(`  HTTP Status: ${err.response.status}`);
      logger.error(`  Response body: ${JSON.stringify(err.response.data)}`);
    }

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};

// Helper to transform parameters from form input to OBP format
// OBP expects: parameters: [{key: "k1", value: "v1"}, {key: "k2", value: "v2"}]
function transformParameters(params: unknown): Array<{key: string, value: string}> {
  // If empty or null, return empty array
  if (!params || params === "") {
    return [];
  }

  // If already an array, return as-is
  if (Array.isArray(params)) {
    return params;
  }

  // If it's a string, try to parse it as JSON
  if (typeof params === "string") {
    const trimmed = params.trim();
    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);

      // If parsed result is an array, return it
      if (Array.isArray(parsed)) {
        return parsed;
      }

      // If parsed result is an object like {"key1": "value1", "key2": "value2"},
      // convert to [{key: "key1", value: "value1"}, {key: "key2", value: "value2"}]
      if (typeof parsed === "object" && parsed !== null) {
        return Object.entries(parsed).map(([key, value]) => ({
          key,
          value: String(value),
        }));
      }
    } catch {
      logger.warn(`Failed to parse parameters as JSON: ${trimmed}`);
      return [];
    }
  }

  // If it's an object (but not array), convert entries
  if (typeof params === "object" && params !== null) {
    return Object.entries(params).map(([key, value]) => ({
      key,
      value: String(value),
    }));
  }

  return [];
}

// POST - Create a new method routing
export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;

  logger.info("=== METHOD ROUTING CREATE API CALL ===");

  if (!session?.data?.user) {
    logger.error("No user in session - returning 401");
    return json(
      { message: "Unauthorized - No user in session", code: 401 }, { status: 401 },
    );
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.error("No access token available for creating method routing");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const body = await request.json();
    logger.info("Creating method routing with raw data:", body);

    // Transform the body for OBP API
    const obpBody = {
      method_name: body.method_name,
      connector_name: body.connector_name,
      is_bank_id_exact_match: body.is_bank_id_exact_match ?? false,
      bank_id_pattern: body.bank_id_pattern || "",
      parameters: transformParameters(body.parameters),
    };

    logger.info("Transformed body for OBP:", obpBody);

    const endpoint = `/obp/v3.1.0/management/method_routings`;
    logger.info(`Request: POST ${endpoint}`);

    const response = await obp_requests.post(endpoint, obpBody, accessToken);

    logger.info("Method routing created successfully");
    logger.debug(JSON.stringify(response, null, 2));

    return json(response, { status: 201 });
  } catch (err) {
    logger.error("ERROR CREATING METHOD ROUTING:");
    logger.error(`  Error type: ${err?.constructor?.name}`);
    logger.error(
      `  Error message: ${err instanceof Error ? err.message : String(err)}`,
    );

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};

// PUT - Update an existing method routing
export const PUT: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;

  logger.info("=== METHOD ROUTING UPDATE API CALL ===");

  if (!session?.data?.user) {
    logger.error("No user in session - returning 401");
    return json(
      { message: "Unauthorized - No user in session", code: 401 }, { status: 401 },
    );
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.error("No access token available for updating method routing");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const body = await request.json();
    const methodRoutingId = body.method_routing_id;

    if (!methodRoutingId) {
      return json(
        { message: "method_routing_id is required for update", code: 400 }, { status: 400 },
      );
    }

    logger.info(`Updating method routing ${methodRoutingId} with raw data:`, body);

    // Transform the body for OBP API
    const obpBody = {
      method_name: body.method_name,
      connector_name: body.connector_name,
      is_bank_id_exact_match: body.is_bank_id_exact_match ?? false,
      bank_id_pattern: body.bank_id_pattern || "",
      parameters: transformParameters(body.parameters),
    };

    logger.info("Transformed body for OBP:", obpBody);

    const endpoint = `/obp/v3.1.0/management/method_routings/${methodRoutingId}`;
    logger.info(`Request: PUT ${endpoint}`);

    const response = await obp_requests.put(endpoint, obpBody, accessToken);

    logger.info("Method routing updated successfully");
    logger.debug(JSON.stringify(response, null, 2));

    return json(response);
  } catch (err) {
    logger.error("ERROR UPDATING METHOD ROUTING:");
    logger.error(`  Error type: ${err?.constructor?.name}`);
    logger.error(
      `  Error message: ${err instanceof Error ? err.message : String(err)}`,
    );

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};

/** DELETE /backend/integration/method-routings?method_routing_id=ID */
export const DELETE: RequestHandler = async ({ locals, url }) => {
  const session = locals.session;
  if (!session?.data?.user) {
    return json({ message: "Unauthorized - No user in session", code: 401 }, { status: 401 });
  }
  const accessToken = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!accessToken) {
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }
  const methodRoutingId = url.searchParams.get("method_routing_id") ?? "";
  if (!methodRoutingId) {
    return json({ message: "method_routing_id is required", code: 400 }, { status: 400 });
  }
  try {
    await obp_requests.delete(`/obp/v3.1.0/management/method_routings/${encodeURIComponent(methodRoutingId)}`, accessToken);
    logger.info(`Deleted method routing ${methodRoutingId}`);
    return json({ deleted: methodRoutingId });
  } catch (err) {
    logger.error(`Error deleting method routing ${methodRoutingId}:`, err);
    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
