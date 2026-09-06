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
import { createLogger } from "@obp/shared/utils";

const logger = createLogger("UserInvitationCreateAPI");

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for user invitation creation");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { bank_id, first_name, last_name, email, company, country, purpose } = body;

    // Validate required fields
    if (!bank_id || !first_name || !last_name || !email || !company || !country || !purpose) {
      return json(
        { message: "Missing required fields", code: 400 }, { status: 400 }
      );
    }

    logger.info("=== CREATE USER INVITATION ===");
    const endpoint = `/obp/v4.0.0/banks/${bank_id}/user-invitation`;
    logger.info(`Request: POST ${endpoint}`);
    logger.info(`Data:`, { first_name, last_name, email, company, country, purpose });

    const payload = {
      first_name,
      last_name,
      email,
      company,
      country,
      purpose
    };

    const response = await obp_requests.post(endpoint, payload, accessToken);

    logger.info(`Response:`, response);

    return json(response, { status: 201 });
  } catch (err: any) {
    logger.error("Error creating user invitation:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
