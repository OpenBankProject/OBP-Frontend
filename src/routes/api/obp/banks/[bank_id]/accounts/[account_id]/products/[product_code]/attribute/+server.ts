import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { extractErrorDetails } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from "$lib/utils/logger";

const logger = createLogger("AccountAttributeAPI");

export const POST: RequestHandler = async ({ locals, params, request }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for creating account attribute");
    return json({ error: "No API access token available" }, { status: 401 });
  }

  const { bank_id, account_id, product_code } = params;

  if (!bank_id || !account_id || !product_code) {
    return json({ error: "Bank ID, Account ID, and Product Code are required" }, { status: 400 });
  }

  try {
    const body = await request.json();

    logger.info(`Creating account attribute: bank=${bank_id}, account=${account_id}, product=${product_code}`);

    const endpoint = `/obp/v3.1.0/banks/${bank_id}/accounts/${account_id}/products/${product_code}/attribute`;
    const response = await obp_requests.post(endpoint, body, accessToken);

    return json(response, { status: 201 });
  } catch (err) {
    logger.error("Error creating account attribute:", err);

    const { message, obpErrorCode } = extractErrorDetails(err);

    const errorResponse: any = { error: message };
    if (obpErrorCode) {
      errorResponse.obpErrorCode = obpErrorCode;
    }

    return json(errorResponse, { status: 500 });
  }
};
