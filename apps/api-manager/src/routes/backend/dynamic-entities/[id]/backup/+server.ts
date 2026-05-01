import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("DynamicEntityBackupAPI");

export const POST: RequestHandler = async ({ params, locals, url }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for dynamic entity backup");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const { id } = params;

    if (!id) {
      return json({ message: "Entity ID is required", code: 400 }, { status: 400 });
    }

    // Check if bank_id is provided for bank-level backup
    const bankId = url.searchParams.get("bank_id");

    let endpoint: string;
    if (bankId) {
      endpoint = `/obp/v6.0.0/management/banks/${bankId}/dynamic-entities/${id}/backup`;
    } else {
      endpoint = `/obp/v6.0.0/management/system-dynamic-entities/${id}/backup`;
    }

    logger.info(`=== DYNAMIC ENTITY BACKUP ===`);
    logger.info(`Request: POST ${endpoint}`);

    const response = await obp_requests.post(endpoint, {}, accessToken);

    logger.info(`Backup created: ${response.entity_name}`);
    return json(response, { status: 201 });
  } catch (err) {
    logger.error("Error backing up dynamic entity:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
