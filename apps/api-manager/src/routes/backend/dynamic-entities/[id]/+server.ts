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

const logger = createLogger("DynamicEntityAPI");

export const GET: RequestHandler = async ({ params, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for dynamic entity retrieval");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const { id } = params;

    if (!id) {
      return json({ message: "Entity ID is required", code: 400 }, { status: 400 });
    }

    logger.info(`Fetching dynamic entity: ${id}`);

    const endpoint = `/obp/v6.0.0/management/system-dynamic-entities/${id}`;
    const response = await obp_requests.get(endpoint, accessToken);

    logger.info("Dynamic entity retrieved successfully");
    return json(response);
  } catch (err) {
    logger.error("Error fetching dynamic entity:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for dynamic entity update");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const { id } = params;

    if (!id) {
      return json({ message: "Entity ID is required", code: 400 }, { status: 400 });
    }

    const body = await request.json();
    const { data } = body;

    if (!data || typeof data !== "object") {
      return json(
        { message: "data is required and must be an object", code: 400 }, { status: 400 },
      );
    }

    logger.info(`Updating dynamic entity: ${id}`);

    const endpoint = `/obp/v6.0.0/management/system-dynamic-entities/${id}`;
    const response = await obp_requests.put(endpoint, { data }, accessToken);

    logger.info("Dynamic entity updated successfully");
    return json(response);
  } catch (err) {
    logger.error("Error updating dynamic entity:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};

export const DELETE: RequestHandler = async ({ params, locals, url }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for dynamic entity deletion");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const { id } = params;

    if (!id) {
      return json({ message: "Entity ID is required", code: 400 }, { status: 400 });
    }

    // Check if cascade parameter is provided
    const cascade = url.searchParams.get("cascade") === "true";

    logger.info(`Deleting dynamic entity: ${id} (cascade: ${cascade})`);

    const endpoint = cascade
      ? `/obp/v6.0.0/management/system-dynamic-entities/cascade/${id}`
      : `/obp/v6.0.0/management/system-dynamic-entities/${id}`;
    logger.info(`Calling DELETE ${endpoint}`);
    const response = await obp_requests.delete(endpoint, accessToken);

    logger.info("Dynamic entity deleted successfully");
    return json(response);
  } catch (err) {
    logger.error("Error deleting dynamic entity:", err);

    // Log full error details
    if (err && typeof err === "object") {
      logger.error("Error details:", JSON.stringify(err, null, 2));
    }

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
