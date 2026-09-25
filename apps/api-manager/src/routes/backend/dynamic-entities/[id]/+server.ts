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
import { dynamicEntityDefinitionsPath } from "@obp/shared/obp";

const logger = createLogger("DynamicEntityAPI");

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

    const cascade = url.searchParams.get("cascade") === "true";
    // The space the definition lives in: a bank id, or none for the system space (SYS).
    const bankId = url.searchParams.get("bank_id");

    logger.info(`Deleting dynamic entity: ${id} (bank_id: ${bankId || "SYS"}, cascade: ${cascade})`);

    const definitions = dynamicEntityDefinitionsPath(bankId);
    const endpoint = cascade ? `${definitions}/cascade/${id}` : `${definitions}/${id}`;
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
