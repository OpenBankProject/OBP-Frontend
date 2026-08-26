import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "@obp/shared/utils";
import { extractDynamicEntityRecords } from "@obp/shared/obp";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";

const logger = createLogger("PersonalDynamicEntityDetailPageServer");

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

  const { entityName } = params;

  if (!entityName) {
    throw error(400, "Entity name is required");
  }

  try {
    // Fetch the discovery endpoint to get entity metadata
    const entitiesResponse = await obp_requests.get(
      "/obp/v6.0.0/personal-dynamic-entities/available",
      accessToken,
    );
    const entities = entitiesResponse.dynamic_entities || [];

    // Find the specific entity by entity_name
    const entity = entities.find((e: any) => e.entity_name === entityName);

    if (!entity) {
      throw error(404, `Personal dynamic entity "${entityName}" not found`);
    }

    logger.info(`Entity fields for ${entityName}: ${JSON.stringify(Object.keys(entity))}`);
    logger.info(`has_public_access: ${entity.has_public_access}, has_community_access: ${entity.has_community_access}, hasPublicAccess: ${entity.hasPublicAccess}, hasCommunityAccess: ${entity.hasCommunityAccess}`);

    // Fetch records for all scopes in parallel
    // Always attempt all scopes - the API will return errors for unsupported ones
    const fetchPromises: Record<string, Promise<any>> = {};

    // My records: always fetch
    fetchPromises.my = obp_requests
      .get(`/obp/dynamic-entity/my/${entityName}`, accessToken)
      .catch((err) => {
        logger.warn("Could not fetch my records:", err);
        return { _error: err instanceof Error ? err.message : "Failed to fetch my records" };
      });

    // Community records: always attempt
    fetchPromises.community = obp_requests
      .get(`/obp/dynamic-entity/community/${entityName}`, accessToken)
      .catch((err) => {
        logger.warn("Could not fetch community records:", err);
        return { _error: err instanceof Error ? err.message : "Failed to fetch community records" };
      });

    // Public records: always attempt
    fetchPromises.public = obp_requests
      .get(`/obp/dynamic-entity/public/${entityName}`, accessToken)
      .then((res) => {
        logger.info(`Public response keys for ${entityName}: ${JSON.stringify(Object.keys(res))}`);
        return res;
      })
      .catch((err) => {
        logger.warn("Could not fetch public records:", err);
        return { _error: err instanceof Error ? err.message : "Failed to fetch public records" };
      });

    // Await all in parallel
    const results: Record<string, any> = {};
    const keys = Object.keys(fetchPromises);
    const values = await Promise.all(Object.values(fetchPromises));
    keys.forEach((key, i) => {
      results[key] = values[i];
    });

    // Extract records or errors
    const myResult = results.my;
    const myRecords = myResult?._error ? [] : extractDynamicEntityRecords(entityName, myResult);
    const myError = myResult?._error || null;

    let communityRecords: any[] = [];
    let communityError: string | null = null;
    if (results.community) {
      if (results.community._error) {
        communityError = results.community._error;
      } else {
        communityRecords = extractDynamicEntityRecords(entityName, results.community);
      }
    }

    let publicRecords: any[] = [];
    let publicError: string | null = null;
    if (results.public) {
      if (results.public._error) {
        publicError = results.public._error;
      } else {
        publicRecords = extractDynamicEntityRecords(entityName, results.public);
      }
    }

    return {
      entity,
      myRecords,
      myError,
      communityRecords,
      communityError,
      publicRecords,
      publicError,
    };
  } catch (err) {
    logger.error("Error fetching personal dynamic entity:", err);

    if (err && typeof err === "object" && "status" in err) {
      throw err;
    }

    throw error(
      500,
      err instanceof Error
        ? err.message
        : "Failed to fetch personal dynamic entity",
    );
  }
};
