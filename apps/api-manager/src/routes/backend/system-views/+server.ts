import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("SystemViewsAPI");

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for system view creation");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name,
      description,
      metadata_view,
      is_public,
      which_alias_to_use,
      hide_metadata_if_alias_used,
      allowed_actions,
      can_grant_access_to_views,
      can_revoke_access_to_views,
    } = body;

    if (!name || typeof name !== "string") {
      return json(
        { message: "name is required and must be a string", code: 400 }, { status: 400 },
      );
    }

    if (!description || typeof description !== "string") {
      return json(
        { message: "description is required and must be a string", code: 400 }, { status: 400 },
      );
    }

    logger.info("Creating system view");
    logger.info(`Name: ${name}`);

    const requestBody: any = {
      name,
      description,
      metadata_view: metadata_view || description,
      is_public: is_public || false,
      which_alias_to_use: which_alias_to_use || "public",
      hide_metadata_if_alias_used: hide_metadata_if_alias_used || false,
      allowed_actions: allowed_actions || [],
    };

    // Add optional fields if provided
    if (can_grant_access_to_views && Array.isArray(can_grant_access_to_views)) {
      requestBody.can_grant_access_to_views = can_grant_access_to_views;
    }

    if (
      can_revoke_access_to_views &&
      Array.isArray(can_revoke_access_to_views)
    ) {
      requestBody.can_revoke_access_to_views = can_revoke_access_to_views;
    }

    const endpoint = `/obp/v6.0.0/system-views`;
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

    logger.info("System view created successfully");
    logger.info("OBP API response:", JSON.stringify(response, null, 2));
    return json(response);
  } catch (err) {
    logger.error("Error creating system view:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
