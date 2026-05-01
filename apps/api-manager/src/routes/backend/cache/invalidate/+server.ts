import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { checkAPIAuth } from "$lib/utils/apiAuth";
import { createLogger } from "@obp/shared/utils";

const logger = createLogger("CacheInvalidateAPI");

export const POST: RequestHandler = async ({ request, locals }) => {
  const auth = checkAPIAuth(locals);
  if (!auth.authenticated) {
    return auth.error!;
  }

  const accessToken = auth.accessToken!;

  try {
    const body = await request.json();
    const { namespace_id } = body;

    if (!namespace_id) {
      return json(
        { message: "namespace_id is required", code: 400 }, { status: 400 }
      );
    }

    logger.info("=== CACHE INVALIDATE API CALL ===");
    const endpoint = `/obp/v6.0.0/management/cache/namespaces/invalidate`;

    logger.info(`Request: ${endpoint}`);
    logger.info(`Invalidating namespace: ${namespace_id}`);

    const response = await obp_requests.post(
      endpoint,
      { namespace_id },
      accessToken
    );

    logger.info(`Successfully invalidated cache namespace: ${namespace_id}`);

    return json(response);
  } catch (err) {
    logger.error("ERROR INVALIDATING CACHE:");
    logger.error(`  Error type: ${err?.constructor?.name}`);
    logger.error(
      `  Error message: ${err instanceof Error ? err.message : String(err)}`,
    );

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
