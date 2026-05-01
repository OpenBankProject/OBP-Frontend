import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("EntitlementsAPI");

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for entitlement creation");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  // Check if user has required entitlements
  const userEntitlements = (session.data.user as any)?.entitlements?.list || [];
  const hasPermission = userEntitlements.some(
    (ent: any) =>
      ent.role_name === "CanCreateEntitlementAtAnyBank" ||
      ent.role_name === "CanCreateEntitlementAtOneBank",
  );

  if (!hasPermission) {
    logger.warn("User does not have permission to create entitlements");
    return json(
      { message: "Insufficient permissions. Required: CanCreateEntitlementAtAnyBank or CanCreateEntitlementAtOneBank", code: 403 }, { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { user_id, role_name, bank_id } = body;

    if (!user_id) {
      return json({ message: "user_id is required", code: 400 }, { status: 400 });
    }

    if (!role_name) {
      return json({ message: "role_name is required", code: 400 }, { status: 400 });
    }

    logger.info("=== CREATE ENTITLEMENT ===");
    logger.info(`User ID: ${user_id}`);
    logger.info(`Role: ${role_name}`);
    logger.info(`Bank ID: ${bank_id || "(empty string)"}`);

    const requestBody: any = {
      role_name,
      // Always include bank_id - use empty string for system-wide roles
      bank_id: bank_id || "",
    };

    const endpoint = `/obp/v6.0.0/users/${user_id}/entitlements`;
    logger.info(`POST ${endpoint}`);
    logger.info(`Request body: ${JSON.stringify(requestBody)}`);

    const response = await obp_requests.post(
      endpoint,
      requestBody,
      accessToken,
    );

    logger.info("Entitlement created successfully");
    logger.info(`Response: ${JSON.stringify(response)}`);

    return json(response);
  } catch (err) {
    const { body, status } = obpErrorResponse(err);

    if (status >= 500) {
      logger.error("Error creating entitlement:", err);
    } else {
      logger.warn(`Entitlement creation rejected (${status}): ${body.message}`);
    }

    return json(body, { status });
  }
};
