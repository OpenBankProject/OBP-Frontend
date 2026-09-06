/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { obpErrorResponse } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("CustomerAccountLinksAPI");

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

  const { bank_id, customer_id } = params;

  if (!bank_id || !customer_id) {
    return json({ message: "Bank ID and Customer ID are required", code: 400 }, { status: 400 });
  }

  try {
    logger.info(`Fetching customer account links for customer: ${customer_id} at bank: ${bank_id}`);

    const endpoint = `/obp/v5.0.0/banks/${encodeURIComponent(bank_id)}/customers/${encodeURIComponent(customer_id)}/customer-account-links`;
    const response = await obp_requests.get(endpoint, accessToken);

    const links = response.links || [];
    logger.info(`Retrieved ${links.length} customer account links for customer ${customer_id}`);

    // Enrich each link with account details (label, routings)
    const enriched = await Promise.all(
      links.map(async (link: any) => {
        try {
          const account = await obp_requests.get(
            `/obp/v6.0.0/banks/${encodeURIComponent(link.bank_id)}/accounts/${encodeURIComponent(link.account_id)}/owner/account`,
            accessToken
          );
          return {
            ...link,
            account_label: account.label || "",
            account_routings: account.account_routings || [],
          };
        } catch {
          return { ...link, account_label: "", account_routings: [] };
        }
      })
    );

    return json({ links: enriched }, { status: 200 });
  } catch (err) {
    logger.error("Error fetching customer account links:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
