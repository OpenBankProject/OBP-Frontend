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

const logger = createLogger("AbacRuleDetailServer");

export const load: PageServerLoad = async ({ params, locals }) => {
  const session = locals.session;
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const token = sessionOAuth?.accessToken;

  if (!token) {
    error(401, {
      message: "Unauthorized: No access token found in session.",
    });
  }

  const ruleId = params.rule_id;

  if (!ruleId) {
    error(400, {
      message: "Rule ID is required",
    });
  }

  // Fetch the specific ABAC rule
  let rule = null;
  let fetchError = null;

  try {
    logger.info(`Fetching ABAC rule with ID: ${ruleId}`);
    const endpoint = `/obp/v6.0.0/management/abac-rules/${ruleId}`;
    rule = await obp_requests.get(endpoint, token);
    logger.debug("ABAC rule data:", JSON.stringify(rule, null, 2));
  } catch (e) {
    logger.error(`Error fetching ABAC rule ${ruleId}:`, e);
    fetchError = e instanceof Error ? e.message : "Failed to fetch ABAC rule";
  }

  if (!rule) {
    error(404, {
      message: fetchError || "ABAC rule not found",
    });
  }

  return {
    rule,
    ruleId,
  };
};
