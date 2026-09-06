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

const logger = createLogger("DynamicEntitiesAPI");

export const POST: RequestHandler = async ({ request, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for dynamic entity creation");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const body = await request.json();
    // Accept both dynamic_entity_id and definition_id for flexibility
    const dynamic_entity_id = body.dynamic_entity_id || body.definition_id;
    const { data } = body;

    if (!dynamic_entity_id) {
      return json(
        { message: "dynamic_entity_id or definition_id is required", code: 400 }, { status: 400 },
      );
    }

    if (!data || typeof data !== "object") {
      return json(
        { message: "data is required and must be an object", code: 400 }, { status: 400 },
      );
    }

    logger.info("Creating dynamic entity");
    logger.info(`Dynamic Entity ID: ${dynamic_entity_id}`);

    const requestBody = {
      dynamic_entity_id,
      data,
    };

    const endpoint = `/obp/v6.0.0/management/system-dynamic-entities`;
    logger.info(`POST ${endpoint}`);

    const response = await obp_requests.post(
      endpoint,
      requestBody,
      accessToken,
    );

    logger.info("Dynamic entity created successfully");
    return json(response);
  } catch (err) {
    logger.error("Error creating dynamic entity:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
