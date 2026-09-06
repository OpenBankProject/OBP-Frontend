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
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { createLogger } from "@obp/shared/utils";

const logger = createLogger("AbacPoliciesServer");

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const token = sessionOAuth?.accessToken;

  if (!token) {
    error(401, {
      message: "Unauthorized: No access token found in session.",
    });
  }

  // Fetch ABAC rules from OBP API
  let abacRules: any[] = [];
  let hasApiAccess = true;
  let errorMessage = null;

  try {
    logger.info("Fetching ABAC rules from API");
    const endpoint = "/obp/v6.0.0/management/abac-rules";
    const response = await obp_requests.get(endpoint, token);

    logger.info("ABAC rules response received");
    logger.debug("Response type:", typeof response);
    logger.debug("Response keys:", response ? Object.keys(response) : "null");
    logger.debug("Full response:", JSON.stringify(response, null, 2));

    // The response should contain an array of rules
    if (response && typeof response === "object") {
      if (Array.isArray(response.abac_rules)) {
        abacRules = response.abac_rules;
        logger.info(
          `Retrieved ${abacRules.length} ABAC rules from response.abac_rules`,
        );
        // Log each rule to check for policy field
        abacRules.forEach((rule, index) => {
          logger.info(`Rule ${index + 1}:`, {
            rule_name: rule.rule_name,
            has_policy: !!rule.policy,
            policy: rule.policy,
            all_keys: Object.keys(rule),
          });
        });
      } else if (Array.isArray(response.rules)) {
        abacRules = response.rules;
        logger.info(
          `Retrieved ${abacRules.length} ABAC rules from response.rules`,
        );
      } else if (Array.isArray(response)) {
        abacRules = response;
        logger.info(
          `Retrieved ${abacRules.length} ABAC rules from array response`,
        );
      } else {
        logger.warn(
          "Response does not contain abac_rules, rules, or is not an array",
        );
        logger.warn("Response structure:", JSON.stringify(response, null, 2));
        abacRules = [];
        errorMessage =
          "API returned unexpected response format. Check server logs for details.";
      }
    } else {
      logger.error("Response is not an object:", response);
      abacRules = [];
      errorMessage = "API returned invalid response";
    }

    if (abacRules.length === 0 && !errorMessage) {
      logger.warn("Successfully fetched but got 0 ABAC rules");
    }
  } catch (e) {
    logger.error("Error fetching ABAC rules:", e);
    logger.error(
      "Error type:",
      e instanceof Error ? e.constructor.name : typeof e,
    );
    if (e instanceof Error) {
      logger.error("Error message:", e.message);
      logger.error("Error stack:", e.stack);
    }
    hasApiAccess = false;
    errorMessage =
      e instanceof Error ? e.message : "Failed to fetch ABAC rules";
  }

  return {
    abacRules,
    hasApiAccess,
    error: errorMessage,
  };
};
