import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { extractErrorDetails } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from "$lib/utils/logger";

const logger = createLogger("CounterpartyDetailAPI");

export const GET: RequestHandler = async ({ locals, params }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for fetching counterparty detail");
    return json({ error: "No API access token available" }, { status: 401 });
  }

  const { bank_id, account_id, view_id, counterparty_id } = params;

  if (!bank_id || !account_id || !view_id || !counterparty_id) {
    return json({ error: "Bank ID, Account ID, View ID and Counterparty ID are required" }, { status: 400 });
  }

  try {
    logger.info(`Fetching counterparty detail: bank=${bank_id}, account=${account_id}, view=${view_id}, counterparty=${counterparty_id}`);

    const endpoint = `/obp/v4.0.0/banks/${encodeURIComponent(bank_id)}/accounts/${encodeURIComponent(account_id)}/${encodeURIComponent(view_id)}/counterparties/${encodeURIComponent(counterparty_id)}`;
    const response = await obp_requests.get(endpoint, accessToken);

    return json(response, { status: 200 });
  } catch (err) {
    logger.error("Error fetching counterparty detail:", err);

    const { message, obpErrorCode } = extractErrorDetails(err);

    const errorResponse: any = { error: message };
    if (obpErrorCode) {
      errorResponse.obpErrorCode = obpErrorCode;
    }

    return json(errorResponse, { status: 500 });
  }
};
