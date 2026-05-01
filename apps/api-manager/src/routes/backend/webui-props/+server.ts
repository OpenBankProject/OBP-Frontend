import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("WebUIPropsAPI");

export const PUT: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for webui prop creation");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, value } = body;

    if (!name || typeof name !== "string") {
      return json(
        { message: "name is required and must be a string", code: 400 }, { status: 400 },
      );
    }

    if (!value || typeof value !== "string") {
      return json(
        { message: "value is required and must be a string", code: 400 }, { status: 400 },
      );
    }

    logger.info("Creating/updating webui prop");
    logger.info(`Name: ${name}`);

    const requestBody = {
      value,
    };

    const endpoint = `/obp/v6.0.0/management/webui_props/${name}`;
    logger.info(`PUT ${endpoint}`);

    const response = await obp_requests.put(endpoint, requestBody, accessToken);

    logger.info("WebUI prop created successfully");
    return json(response);
  } catch (err) {
    logger.error("Error creating webui prop:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
