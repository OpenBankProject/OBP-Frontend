import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "$lib/utils/logger";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";

const logger = createLogger("SystemDynamicEndpointDetailPageServer");

export const load: PageServerLoad = async ({ params, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    throw error(401, "No API access token available");
  }

  const { id } = params;

  if (!id) {
    throw error(400, "Endpoint ID is required");
  }

  try {
    // Fetch the specific dynamic endpoint
    const endpoint = `/obp/v6.0.0/management/dynamic-endpoints/${id}`;
    const dynamicEndpoint = await obp_requests.get(endpoint, accessToken);

    if (!dynamicEndpoint) {
      throw error(404, "System dynamic endpoint not found");
    }

    // Fetch all JSON Schema Validations (per-operation_id) — non-fatal
    let validations: Array<{ operation_id: string; json_schema: any }> = [];
    try {
      const resp = await obp_requests.get(
        `/obp/v4.0.0/management/json-schema-validations`,
        accessToken,
      );
      validations = resp?.json_schema_validations || [];
      logger.debug(`Retrieved ${validations.length} JSON schema validations`);
    } catch (e) {
      logger.warn("Could not fetch JSON schema validations:", e);
    }

    // Fetch all Endpoint Mappings (per-operation_id) — non-fatal. Only meaningful
    // when the endpoint's host is dynamic_entity; still fetched unconditionally so
    // the client can filter/display without an extra roundtrip.
    let mappings: Array<{
      endpoint_mapping_id: string;
      operation_id: string;
      request_mapping: any;
      response_mapping: any;
    }> = [];
    try {
      const resp = await obp_requests.get(
        `/obp/v4.0.0/management/endpoint-mappings`,
        accessToken,
      );
      mappings = resp?.["endpoint-mappings"] || [];
      logger.debug(`Retrieved ${mappings.length} endpoint mappings`);
    } catch (e) {
      logger.warn("Could not fetch endpoint mappings:", e);
    }

    return {
      endpoint: dynamicEndpoint,
      validations,
      mappings,
    };
  } catch (err) {
    logger.error("Error fetching system dynamic endpoint:", err);

    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }

    throw error(
      500,
      err instanceof Error
        ? err.message
        : "Failed to fetch system dynamic endpoint",
    );
  }
};
