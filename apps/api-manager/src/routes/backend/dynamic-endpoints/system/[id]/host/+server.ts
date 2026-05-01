import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("SystemDynamicEndpointHostAPI");

export const PUT: RequestHandler = async ({ params, request, locals }) => {
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
      return json({ message: "Endpoint ID is required", code: 400 }, { status: 400 });
    }

    const body = await request.json();

    if (!body || typeof body !== "object" || !body.host) {
      return json(
        { message: "host is required in the request body", code: 400 }, { status: 400 },
      );
    }

    logger.info(`Updating host for system dynamic endpoint: ${id}`);
    logger.info("Payload:", JSON.stringify(body, null, 2));

    const endpoint = `/obp/v6.0.0/management/dynamic-endpoints/${id}/host`;
    const response = await obp_requests.put(endpoint, body, accessToken);

    logger.info("System dynamic endpoint host updated successfully");
    return json(response);
  } catch (err) {
    logger.error("Error updating system dynamic endpoint host:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
