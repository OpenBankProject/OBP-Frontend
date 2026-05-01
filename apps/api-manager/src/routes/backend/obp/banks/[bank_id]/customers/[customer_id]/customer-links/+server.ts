import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("CustomerLinksAPI");

export const GET: RequestHandler = async ({ locals, params }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for fetching customer links");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  const { bank_id, customer_id } = params;

  if (!bank_id || !customer_id) {
    return json({ message: "Bank ID and Customer ID are required", code: 400 }, { status: 400 });
  }

  try {
    logger.info(`Fetching customer links for customer: ${customer_id} at bank: ${bank_id}`);

    const endpoint = `/obp/v6.0.0/banks/${encodeURIComponent(bank_id)}/customers/${encodeURIComponent(customer_id)}/customer-links`;
    const response = await obp_requests.get(endpoint, accessToken);

    const customerLinks = response.customer_links || [];

    // Enrich each link with the other customer's legal_name
    const enriched = await Promise.all(
      customerLinks.map(async (link: any) => {
        try {
          const otherCustomer = await obp_requests.get(
            `/obp/v6.0.0/banks/${encodeURIComponent(link.other_bank_id)}/customers/${encodeURIComponent(link.other_customer_id)}`,
            accessToken
          );
          return { ...link, other_customer_legal_name: otherCustomer.legal_name || "" };
        } catch {
          return { ...link, other_customer_legal_name: "" };
        }
      })
    );

    logger.info(`Retrieved ${enriched.length} customer links for customer ${customer_id}`);

    return json({ customer_links: enriched }, { status: 200 });
  } catch (err) {
    logger.error("Error fetching customer links:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
