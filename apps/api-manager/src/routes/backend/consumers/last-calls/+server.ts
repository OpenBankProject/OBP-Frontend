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
import { checkAPIAuth } from "$lib/utils/apiAuth";
import { createLogger } from "@obp/shared/utils";

const logger = createLogger("ConsumerLastCallsAPI");

// The list page asks for the consumers it has on screen, a batch at a time.
const MAX_IDS = 25;
const CONCURRENCY = 5;
const CONSUMER_ID = /^[A-Za-z0-9_-]{1,100}$/;
// Without from_date OBP looks back only MappedMetrics.stable.boundary.seconds (10 minutes by
// default). A constant keeps the query cache key stable.
const FROM_DATE = "1970-01-01T00:00:00.000Z";

// GET ?consumer_ids=a,b,c (comma separated: OBP-style repeated params are not used).
// Returns { last_calls: { [consumer_id]: date | null } } where null means no recorded call.
// A consumer whose lookup failed is left out. Without CanReadMetrics the map is empty.
export const GET: RequestHandler = async ({ url, locals }) => {
  const auth = checkAPIAuth(locals);
  if (!auth.authenticated) {
    return auth.error!;
  }

  const entitlements = (locals.session.data.user as any)?.entitlements?.list || [];
  const canReadMetrics = entitlements.some(
    (entitlement: any) => entitlement.role_name === "CanReadMetrics",
  );
  if (!canReadMetrics) {
    return json({ last_calls: {} });
  }

  const consumerIds = (url.searchParams.get("consumer_ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => CONSUMER_ID.test(id))
    .slice(0, MAX_IDS);

  const lastCalls: Record<string, string | null> = {};
  for (let i = 0; i < consumerIds.length; i += CONCURRENCY) {
    await Promise.all(
      consumerIds.slice(i, i + CONCURRENCY).map(async (consumerId) => {
        try {
          const response = await obp_requests.get(
            `/obp/v6.0.0/management/metrics?consumer_id=${encodeURIComponent(consumerId)}&from_date=${encodeURIComponent(FROM_DATE)}&limit=1&sort_by=date&sort_direction=desc`,
            auth.accessToken!,
          );
          lastCalls[consumerId] = response?.metrics?.[0]?.date ?? null;
        } catch (err) {
          logger.warn(`Last call lookup failed for consumer_id ${consumerId}:`, err);
        }
      }),
    );
  }

  return json({ last_calls: lastCalls });
};
