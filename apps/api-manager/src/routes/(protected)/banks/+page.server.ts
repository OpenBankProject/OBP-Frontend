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
import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "@obp/shared/utils";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";

const logger = createLogger("BanksPageServer");

export const load: PageServerLoad = async ({ locals }) => {
  logger.info("=== Banks Page Load Started ===");

  const session = locals.session;

  if (!session?.data?.user) {
    logger.error("No user in session");
    throw error(401, "Unauthorized");
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.error("No access token available");
    throw error(401, "No API access token available");
  }

  logger.info("Access token present, fetching banks");

  try {
    const endpoint = "/obp/v6.0.0/banks";
    logger.info(`Making API request to: ${endpoint}`);

    const response = await obp_requests.get(endpoint, accessToken);

    const banks = response.banks || [];
    logger.info(`Retrieved ${banks.length} banks`);

    // Sort banks alphabetically by full_name
    banks.sort((a: any, b: any) => {
      const nameA = (a.full_name || "").toLowerCase();
      const nameB = (b.full_name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return {
      banks,
    };
  } catch (err: any) {
    logger.error("Error fetching banks:", err);
    return {
      banks: [],
      error:
        err instanceof Error ? err.message : "Failed to fetch banks",
    };
  }
};
