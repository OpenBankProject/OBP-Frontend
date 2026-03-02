import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { extractErrorDetails } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from "$lib/utils/logger";

const logger = createLogger("FxRateAPI");

export const GET: RequestHandler = async ({ locals, params }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for fetching FX rate");
    return json({ error: "No API access token available" }, { status: 401 });
  }

  const { bank_id, from_currency, to_currency } = params;

  if (!bank_id || !from_currency || !to_currency) {
    return json({ error: "Bank ID, from currency, and to currency are required" }, { status: 400 });
  }

  try {
    logger.info(`Fetching FX rate for bank ${bank_id}: ${from_currency} -> ${to_currency}`);

    const endpoint = `/obp/v6.0.0/banks/${encodeURIComponent(bank_id)}/fx/${encodeURIComponent(from_currency)}/${encodeURIComponent(to_currency)}`;
    const response = await obp_requests.get(endpoint, accessToken);

    logger.info(`Retrieved FX rate for ${from_currency} -> ${to_currency}`);

    return json(response, { status: 200 });
  } catch (err) {
    logger.error("Error fetching FX rate:", err);

    const { message, obpErrorCode } = extractErrorDetails(err);

    const errorResponse: any = { error: message };
    if (obpErrorCode) {
      errorResponse.obpErrorCode = obpErrorCode;
    }

    return json(errorResponse, { status: 500 });
  }
};
