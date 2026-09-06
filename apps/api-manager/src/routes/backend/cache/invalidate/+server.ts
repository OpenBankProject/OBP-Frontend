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
import { checkAPIAuth } from "$lib/utils/apiAuth";
import { createLogger } from "@obp/shared/utils";

const logger = createLogger("CacheInvalidateAPI");

export const POST: RequestHandler = async ({ request, locals }) => {
  const auth = checkAPIAuth(locals);
  if (!auth.authenticated) {
    return auth.error!;
  }

  const accessToken = auth.accessToken!;

  try {
    const body = await request.json();
    const { namespace_id } = body;

    if (!namespace_id) {
      return json(
        { message: "namespace_id is required", code: 400 }, { status: 400 }
      );
    }

    logger.info("=== CACHE INVALIDATE API CALL ===");
    const endpoint = `/obp/v6.0.0/management/cache/namespaces/invalidate`;

    logger.info(`Request: ${endpoint}`);
    logger.info(`Invalidating namespace: ${namespace_id}`);

    const response = await obp_requests.post(
      endpoint,
      { namespace_id },
      accessToken
    );

    logger.info(`Successfully invalidated cache namespace: ${namespace_id}`);

    return json(response);
  } catch (err) {
    logger.error("ERROR INVALIDATING CACHE:");
    logger.error(`  Error type: ${err?.constructor?.name}`);
    logger.error(
      `  Error message: ${err instanceof Error ? err.message : String(err)}`,
    );

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
