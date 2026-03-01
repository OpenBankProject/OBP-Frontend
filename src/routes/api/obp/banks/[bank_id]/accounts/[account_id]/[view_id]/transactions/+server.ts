import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { extractErrorDetails } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from "$lib/utils/logger";

const logger = createLogger("TransactionsAPI");

export const GET: RequestHandler = async ({ locals, params, url }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for fetching transactions");
    return json({ error: "No API access token available" }, { status: 401 });
  }

  const { bank_id, account_id, view_id } = params;

  if (!bank_id || !account_id || !view_id) {
    return json({ error: "Bank ID, Account ID and View ID are required" }, { status: 400 });
  }

  try {
    const limit = url.searchParams.get("limit") || "50";
    const offset = url.searchParams.get("offset") || "0";
    const sort_direction = url.searchParams.get("sort_direction") || "DESC";

    logger.info(`Fetching transactions: bank=${bank_id}, account=${account_id}, view=${view_id}`);

    const endpoint = `/obp/v6.0.0/banks/${encodeURIComponent(bank_id)}/accounts/${encodeURIComponent(account_id)}/${encodeURIComponent(view_id)}/transactions?limit=${limit}&offset=${offset}&sort_direction=${sort_direction}`;
    const response = await obp_requests.get(endpoint, accessToken);

    return json(response, { status: 200 });
  } catch (err) {
    logger.error("Error fetching transactions:", err);

    const { message, obpErrorCode } = extractErrorDetails(err);

    const errorResponse: any = { error: message };
    if (obpErrorCode) {
      errorResponse.obpErrorCode = obpErrorCode;
    }

    return json(errorResponse, { status: 500 });
  }
};
