import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("AbacRulesAPI");

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for ABAC rule creation");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { rule_name, rule_code, description, is_active, policy } = body;

    // Validate required fields
    if (!rule_name || typeof rule_name !== "string") {
      return json(
        { message: "rule_name is required and must be a string", code: 400 }, { status: 400 },
      );
    }

    if (!rule_code || typeof rule_code !== "string") {
      return json(
        { message: "rule_code is required and must be a string", code: 400 }, { status: 400 },
      );
    }

    if (!policy || typeof policy !== "string") {
      return json(
        { message: "policy is required and must be a string", code: 400 }, { status: 400 },
      );
    }

    logger.info("Creating ABAC rule");
    logger.info(`Rule Name: ${rule_name}`);
    logger.info(`Rule Code: ${rule_code}`);

    // Build request body matching OBP API structure
    const requestBody: any = {
      rule_name,
      rule_code,
      is_active: is_active !== undefined ? is_active : true,
    };

    if (description) {
      requestBody.description = description;
    }

    requestBody.policy = policy;

    const endpoint = `/obp/v6.0.0/management/abac-rules`;
    logger.info(`POST ${endpoint}`);
    logger.info(
      "Request body being sent to OBP:",
      JSON.stringify(requestBody, null, 2),
    );

    const response = await obp_requests.post(
      endpoint,
      requestBody,
      accessToken,
    );

    logger.info("ABAC rule created successfully");
    logger.info("OBP API response:", JSON.stringify(response, null, 2));
    return json(response);
  } catch (err) {
    logger.error("Error creating ABAC rule:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
