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

const logger = createLogger("ApiCollectionsAPI");

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for collection creation");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { api_collection_name, description, is_sharable } = body;

    if (!api_collection_name) {
      return json(
        { message: "api_collection_name is required", code: 400 }, { status: 400 },
      );
    }

    logger.info("=== CREATE API COLLECTION ===");
    logger.info(`Name: ${api_collection_name}`);
    logger.info(`Description: ${description}`);
    logger.info(`Is Sharable: ${is_sharable}`);

    const requestBody: any = {
      api_collection_name,
      is_sharable: is_sharable ?? false,
    };

    // Only include description if provided
    if (description && description.trim() !== "") {
      requestBody.description = description;
    }

    const endpoint = `/obp/v6.0.0/my/api-collections`;
    logger.info(`POST ${endpoint}`);
    logger.info(`Request body: ${JSON.stringify(requestBody)}`);

    const response = await obp_requests.post(
      endpoint,
      requestBody,
      accessToken,
    );

    logger.info("API collection created successfully");
    logger.info(`Response: ${JSON.stringify(response)}`);

    return json(response);
  } catch (err) {
    logger.error("Error creating API collection:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
