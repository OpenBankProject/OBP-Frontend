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
import { obpErrorResponse } from "@obp/shared/obp";
import { createLogger } from "@obp/shared/utils";

const logger = createLogger("RolesAPI");

export const GET: RequestHandler = async ({ locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  try {
    const accessToken = session.data.oauth?.access_token;
    const response = await obp_requests.get("/obp/v2.1.0/roles", accessToken);
    return json(response);
  } catch (err: unknown) {
    logger.error("Error fetching roles:", err);
    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
