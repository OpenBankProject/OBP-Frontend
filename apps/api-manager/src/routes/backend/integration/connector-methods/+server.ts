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

const logger = createLogger("ConnectorMethodsAPI");

// GET - Fetch all connector methods
export const GET: RequestHandler = async ({ locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    logger.error("No user in session - returning 401");
    return json(
      { message: "Unauthorized - No user in session", code: 401 }, { status: 401 },
    );
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.error("No access token available for connector methods API call");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    logger.info("=== CONNECTOR METHODS API CALL ===");
    const endpoint = `/obp/v6.0.0/management/connector-methods`;
    logger.info(`Request: ${endpoint}`);

    const response = await obp_requests.get(endpoint, accessToken);

    logger.info("Connector methods fetched successfully");
    logger.info(`Response: ${response?.connectors_methods?.length || 0} connector methods`);

    return json(response.connectors_methods || []);
  } catch (err) {
    logger.error("ERROR FETCHING CONNECTOR METHODS:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
