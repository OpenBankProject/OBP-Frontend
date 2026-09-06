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

const logger = createLogger("SystemViewUpdateAPI");

export const PUT: RequestHandler = async ({ params, request, locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for system view update");
    return json({ message: "No API access token available", code: 401 }, { status: 401 });
  }

  try {
    const { view_id } = params;

    if (!view_id) {
      return json({ message: "View ID is required", code: 400 }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      description,
      metadata_view,
      is_public,
      which_alias_to_use,
      hide_metadata_if_alias_used,
      allowed_actions,
      can_grant_access_to_views,
      can_revoke_access_to_views,
    } = body;

    if (!name || typeof name !== "string") {
      return json(
        { message: "name is required and must be a string", code: 400 }, { status: 400 },
      );
    }

    if (!description || typeof description !== "string") {
      return json(
        { message: "description is required and must be a string", code: 400 }, { status: 400 },
      );
    }

    logger.info("Updating system view");
    logger.info(`View ID: ${view_id}`);
    logger.info(`Name: ${name}`);

    const requestBody: any = {
      name,
      description,
      metadata_view: metadata_view || description,
      is_public: is_public || false,
      which_alias_to_use: which_alias_to_use || "public",
      hide_metadata_if_alias_used: hide_metadata_if_alias_used || false,
      allowed_actions: allowed_actions || [],
    };

    // Add optional fields if provided
    if (can_grant_access_to_views && Array.isArray(can_grant_access_to_views)) {
      requestBody.can_grant_access_to_views = can_grant_access_to_views;
    }

    if (
      can_revoke_access_to_views &&
      Array.isArray(can_revoke_access_to_views)
    ) {
      requestBody.can_revoke_access_to_views = can_revoke_access_to_views;
    }

    const endpoint = `/obp/v6.0.0/management/system-views/${view_id}`;
    logger.info(`PUT ${endpoint}`);
    logger.info(
      "Request body being sent to OBP:",
      JSON.stringify(requestBody, null, 2),
    );

    const response = await obp_requests.put(
      endpoint,
      requestBody,
      accessToken,
    );

    logger.info("System view updated successfully");
    logger.info("OBP API response:", JSON.stringify(response, null, 2));
    return json(response);
  } catch (err) {
    logger.error("Error updating system view:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
