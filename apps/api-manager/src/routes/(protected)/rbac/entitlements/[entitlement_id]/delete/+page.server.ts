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
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from "@obp/shared/utils";

const logger = createLogger("EntitlementDeletePage");

export const load: PageServerLoad = async ({ params, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  const entitlement_id = params.entitlement_id;

  if (!entitlement_id) {
    throw error(400, "Entitlement ID is required");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available");
    return {
      entitlement_id,
      entitlement: null,
      user: null,
      bank: null,
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    logger.info(`Loading entitlement details for ID: ${entitlement_id}`);

    // Fetch all entitlements and find the specific one
    const allEntitlementsEndpoint = `/obp/v6.0.0/entitlements`;
    const entitlementsResponse = await obp_requests.get(
      allEntitlementsEndpoint,
      accessToken,
    );

    const entitlement = entitlementsResponse.list?.find(
      (e: any) => e.entitlement_id === entitlement_id,
    );

    if (!entitlement) {
      logger.warn(`Entitlement ${entitlement_id} not found`);
      return {
        entitlement_id,
        entitlement: null,
        user: null,
        bank: null,
        hasApiAccess: true,
        error: "Entitlement not found",
      };
    }

    logger.info("Entitlement loaded successfully");

    // Fetch user details if we have a user_id
    let user = null;
    if (entitlement.user_id) {
      try {
        const userEndpoint = `/obp/v6.0.0/users/user_id/${entitlement.user_id}`;
        user = await obp_requests.get(userEndpoint, accessToken);
      } catch (err) {
        logger.warn(`Failed to load user details: ${err}`);
      }
    }

    // Fetch bank details if we have a bank_id
    let bank = null;
    if (entitlement.bank_id) {
      try {
        const bankEndpoint = `/obp/v6.0.0/banks/${entitlement.bank_id}`;
        bank = await obp_requests.get(bankEndpoint, accessToken);
      } catch (err) {
        logger.warn(`Failed to load bank details: ${err}`);
      }
    }

    return {
      entitlement_id,
      entitlement,
      user,
      bank,
      hasApiAccess: true,
      error: null,
    };
  } catch (err) {
    logger.error("Error loading entitlement:", err);

    const errorMessage =
      err instanceof Error ? err.message : "Failed to load entitlement";

    return {
      entitlement_id,
      entitlement: null,
      user: null,
      bank: null,
      hasApiAccess: true,
      error: errorMessage,
    };
  }
};
