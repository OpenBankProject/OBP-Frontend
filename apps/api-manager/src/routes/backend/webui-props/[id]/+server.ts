import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("WebUIPropAPI");

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for webui prop update");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const { id } = params;

    if (!id) {
      return json({ message: "Prop name is required", code: 400 }, { status: 400 });
    }

    const body = await request.json();
    const { value } = body;

    if (!value || typeof value !== "string") {
      return json(
        { message: "value is required and must be a string", code: 400 }, { status: 400 },
      );
    }

    logger.info(`Updating webui prop: ${id}`);

    const requestBody = {
      value,
    };

    const endpoint = `/obp/v6.0.0/management/webui_props/${id}`;
    const response = await obp_requests.put(endpoint, requestBody, accessToken);

    logger.info("WebUI prop updated successfully");
    return json(response);
  } catch (err) {
    logger.error("Error updating webui prop:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for webui prop deletion");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const { id } = params;

    if (!id) {
      return json({ message: "Prop name is required", code: 400 }, { status: 400 });
    }

    logger.info(`Deleting webui prop: ${id}`);

    const endpoint = `/obp/v6.0.0/management/webui_props/${id}`;
    logger.info(`Calling DELETE ${endpoint}`);
    const response = await obp_requests.delete(endpoint, accessToken);

    logger.info("WebUI prop deleted successfully");
    return json(response);
  } catch (err) {
    logger.error("Error deleting webui prop:", err);

    // Log full error details
    if (err && typeof err === "object") {
      logger.error("Error details:", JSON.stringify(err, null, 2));
    }

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
