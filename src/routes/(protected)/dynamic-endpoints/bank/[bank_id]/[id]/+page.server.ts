import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "$lib/utils/logger";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";

const logger = createLogger("BankDynamicEndpointDetailPageServer");

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

  const { bank_id, id } = params;

  if (!bank_id) {
    throw error(400, "Bank ID is required");
  }

  if (!id) {
    throw error(400, "Endpoint ID is required");
  }

  try {
    // Fetch the specific dynamic endpoint
    const endpoint = `/obp/v6.0.0/management/banks/${bank_id}/dynamic-endpoints/${id}`;
    const dynamicEndpoint = await obp_requests.get(endpoint, accessToken);

    if (!dynamicEndpoint) {
      throw error(404, "Bank dynamic endpoint not found");
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

    // Fetch bank-level Endpoint Mappings (per-operation_id) — non-fatal.
    let mappings: Array<{
      endpoint_mapping_id: string;
      operation_id: string;
      request_mapping: any;
      response_mapping: any;
    }> = [];
    try {
      const resp = await obp_requests.get(
        `/obp/v4.0.0/management/banks/${bank_id}/endpoint-mappings`,
        accessToken,
      );
      mappings = resp?.["endpoint-mappings"] || [];
      logger.debug(`Retrieved ${mappings.length} bank endpoint mappings`);
    } catch (e) {
      logger.warn("Could not fetch bank endpoint mappings:", e);
    }

    return {
      endpoint: dynamicEndpoint,
      bank_id,
      validations,
      mappings,
    };
  } catch (err) {
    logger.error("Error fetching bank dynamic endpoint:", err);

    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }

    throw error(
      500,
      err instanceof Error
        ? err.message
        : "Failed to fetch bank dynamic endpoint",
    );
  }
};
