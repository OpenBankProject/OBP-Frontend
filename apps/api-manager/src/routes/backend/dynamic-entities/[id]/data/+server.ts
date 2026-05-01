import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("DynamicEntityDataAPI");

// Helper function to get entity name from entity ID
async function getEntityName(
  entityId: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const entitiesResponse = await obp_requests.get(
      "/obp/v6.0.0/management/system-dynamic-entities",
      accessToken,
    );
    const entities = entitiesResponse.dynamic_entities || [];
    const entity = entities.find((e: any) => e.dynamic_entity_id === entityId);

    if (!entity) return null;

    // In v6.0.0, the entity name is in the entity_name field
    return entity.entity_name || null;
  } catch (err) {
    logger.error("Error fetching entity name:", err);
    return null;
  }
}

// GET - List all records for an entity
export const GET: RequestHandler = async ({ params, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const { id } = params;

    if (!id) {
      return json({ message: "Entity ID is required", code: 400 }, { status: 400 });
    }

    // Get entity name from ID
    const entityName = await getEntityName(id, accessToken);
    if (!entityName) {
      return json({ message: "Entity not found", code: 404 }, { status: 404 });
    }

    logger.info(`Fetching records for entity: ${entityName}`);

    const endpoint = `/obp/dynamic-entity/${entityName}`;
    const response = await obp_requests.get(endpoint, accessToken);

    logger.info("Records retrieved successfully");
    return json(response);
  } catch (err) {
    logger.error("Error fetching records:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};

// POST - Create a new record
export const POST: RequestHandler = async ({ params, request, locals }) => {
  logger.info("=== POST Create Record Request ===");
  logger.info("Params:", params);

  const session = locals.session;
  logger.info("Session exists:", !!session);
  logger.info("Session has data:", !!session?.data);
  logger.info("Session has user:", !!session?.data?.user);

  if (!session?.data?.user) {
    logger.error("Unauthorized: No session or user data");
    return json({ message: "Unauthorized - No session", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  logger.info("SessionOAuth retrieved:", !!sessionOAuth);

  const accessToken = sessionOAuth?.accessToken;
  logger.info("Access token available:", !!accessToken);

  if (!accessToken) {
    logger.error("No access token available in session");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const { id } = params;

    if (!id) {
      return json({ message: "Entity ID is required", code: 400 }, { status: 400 });
    }

    const body = await request.json();
    logger.info("Request body received:", JSON.stringify(body, null, 2));

    if (!body || typeof body !== "object") {
      logger.error("Invalid request body");
      return json(
        { message: "Request body must be a valid object", code: 400 }, { status: 400 },
      );
    }

    // Get entity name from ID
    logger.info(`Looking up entity name for ID: ${id}`);
    const entityName = await getEntityName(id, accessToken);
    logger.info(`Entity name resolved: ${entityName}`);

    if (!entityName) {
      logger.error(`Entity not found for ID: ${id}`);
      return json({ message: "Entity not found", code: 404 }, { status: 404 });
    }

    logger.info(`Creating record for entity: ${entityName}`);
    logger.info(`Request data: ${JSON.stringify(body)}`);

    // Log detailed type information
    Object.keys(body).forEach((key) => {
      const value = body[key];
      const type = typeof value;
      logger.info(
        `Field '${key}': value='${value}', type='${type}', isNumber=${typeof value === "number"}, isInteger=${Number.isInteger(value)}`,
      );
    });

    const endpoint = `/obp/dynamic-entity/${entityName}`;
    logger.info(`Calling OBP endpoint: POST ${endpoint}`);
    logger.info(`Request body being sent to OBP: ${JSON.stringify(body)}`);
    logger.info(
      `Stringified body type check:`,
      typeof body,
      Array.isArray(body),
    );

    const response = await obp_requests.post(endpoint, body, accessToken);

    logger.info("Record created successfully");
    logger.info("Response:", JSON.stringify(response));
    return json(response);
  } catch (err) {
    logger.error("Error creating record:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
