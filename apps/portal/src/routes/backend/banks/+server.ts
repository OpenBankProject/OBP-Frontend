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
import { createLogger } from "@obp/shared/utils";
import { obpErrorResponse } from "@obp/shared/obp";

const logger = createLogger("BanksAPI");

export const GET: RequestHandler = async ({ locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    return json({ message: "Unauthorized", code: 401 }, { status: 401 });
  }

  try {
    const endpoint = `/obp/v6.0.0/banks`;
    const accessToken = session.data.oauth?.access_token;
    const response = await obp_requests.get(endpoint, accessToken);

    const banks = (response.banks || []).filter(
      (b: any) => b.bank_id != null,
    );

    return json({
      banks,
      count: banks.length,
    });
  } catch (err: unknown) {
    logger.error("Error fetching banks:", err);

    const { body, status } = obpErrorResponse(err);
    return json(body, { status });
  }
};
