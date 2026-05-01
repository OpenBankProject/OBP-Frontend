import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("EntitlementDeleteAPI");

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const entitlement_id = params.entitlement_id;

  if (!entitlement_id) {
    return json({ message: "entitlement_id is required", code: 400 }, { status: 400 });
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for entitlement deletion");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  // Check if user has required entitlements
  const userEntitlements = (session.data.user as any)?.entitlements?.list || [];
  const hasPermission = userEntitlements.some(
    (ent: any) =>
      ent.role_name === "CanDeleteEntitlementAtAnyBank" ||
      ent.role_name === "CanDeleteEntitlementAtOneBank",
  );

  if (!hasPermission) {
    logger.warn("User does not have permission to delete entitlements");
    return json(
      { message: "Insufficient permissions. Required: CanDeleteEntitlementAtAnyBank or CanDeleteEntitlementAtOneBank", code: 403 }, { status: 403 },
    );
  }

  try {
    logger.info("=== DELETE ENTITLEMENT ===");
    logger.info(`Entitlement ID: ${entitlement_id}`);

    // Use v6.0.0 DELETE endpoint: /obp/v6.0.0/entitlements/{ENTITLEMENT_ID}
    const endpoint = `/obp/v6.0.0/entitlements/${entitlement_id}`;
    logger.info(`DELETE ${endpoint}`);

    const response = await obp_requests.delete(endpoint, accessToken);

    logger.info("Entitlement deleted successfully");

    return json(response, { status: 200 });
  } catch (err) {
    const { body, status } = obpErrorResponse(err);

    logger.error("========================================");
    logger.error(`  FAILED TO DELETE ENTITLEMENT`);
    logger.error(`  Entitlement ID: ${entitlement_id}`);
    logger.error(`  HTTP Status: ${status}`);
    logger.error(`  OBP Error Code: ${body.code || "none"}`);
    logger.error(`  Message: ${body.message}`);
    logger.error(`  Raw error: ${err instanceof Error ? err.stack || err.message : String(err)}`);
    logger.error("========================================");

    return json(body, { status });
  }
};
