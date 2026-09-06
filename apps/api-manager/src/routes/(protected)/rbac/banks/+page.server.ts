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
import { createLogger } from "@obp/shared/utils";
const logger = createLogger("BanksPageServer");
import type { PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { error } from "@sveltejs/kit";

interface Bank {
  bank_id: string;
  short_name: string;
  full_name: string;
  logo?: string;
  website?: string;
  bank_routings?: Array<{
    scheme: string;
    address: string;
  }>;
}

interface BanksResponse {
  banks: Bank[];
}

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for banks API calls");
    return {
      banks: [],
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    logger.info("=== BANKS API CALL ===");
    const endpoint = `/obp/v6.0.0/banks`;
    logger.info(`Request: ${endpoint}`);

    const response: BanksResponse = await obp_requests.get(
      endpoint,
      accessToken,
    );

    const banks = response.banks || [];
    logger.info(`Response: ${banks.length} banks`);

    // Sort banks by bank_id
    banks.sort((a, b) => (a.bank_id || "").localeCompare(b.bank_id || ""));

    return {
      banks,
      hasApiAccess: true,
      error: null,
    };
  } catch (err) {
    logger.error("Error loading banks:", err);

    return {
      banks: [],
      hasApiAccess: false,
      error: err instanceof Error ? err.message : "Failed to load banks",
    };
  }
};
