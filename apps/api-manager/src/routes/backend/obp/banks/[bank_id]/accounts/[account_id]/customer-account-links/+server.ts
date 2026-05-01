import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("CustomerAccountLinksByAccountAPI");

export const GET: RequestHandler = async ({ locals, params }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for fetching customer account links");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  const { bank_id, account_id } = params;

  if (!bank_id || !account_id) {
    return json({ message: "Bank ID and Account ID are required", code: 400 }, { status: 400 });
  }

  try {
    logger.info(`Fetching customer account links for account: ${account_id} at bank: ${bank_id}`);

    const endpoint = `/obp/v5.0.0/banks/${encodeURIComponent(bank_id)}/accounts/${encodeURIComponent(account_id)}/customer-account-links`;
    const response = await obp_requests.get(endpoint, accessToken);

    const links = response.links || [];
    logger.info(`Retrieved ${links.length} customer account links for account ${account_id}`);

    // Fetch account details and enrich customer names in parallel
    const [accountDetails, ...customerResults] = await Promise.all([
      obp_requests.get(
        `/obp/v6.0.0/banks/${encodeURIComponent(bank_id)}/accounts/${encodeURIComponent(account_id)}/owner/account`,
        accessToken
      ).catch(() => null),
      ...links.map(async (link: any) => {
        try {
          const customer = await obp_requests.get(
            `/obp/v6.0.0/banks/${encodeURIComponent(link.bank_id)}/customers/${encodeURIComponent(link.customer_id)}`,
            accessToken
          );
          return { ...link, legal_name: customer.legal_name || "" };
        } catch {
          return { ...link, legal_name: "" };
        }
      }),
    ]);

    return json({
      links: customerResults,
      account_label: accountDetails?.label || "",
      account_routings: accountDetails?.account_routings || [],
    }, { status: 200 });
  } catch (err) {
    logger.error("Error fetching customer account links:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
