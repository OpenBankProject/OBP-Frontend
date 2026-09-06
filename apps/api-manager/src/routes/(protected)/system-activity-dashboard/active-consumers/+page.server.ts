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
import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "@obp/shared/utils";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { OBPRequestError } from "$lib/obp/errors";
import { unwrapAggregateMetric } from "@obp/shared/obp";

const logger = createLogger("DashboardActiveConsumersServer");

const TOP_CONSUMERS_LIMIT = 1000;

interface TopConsumerRow {
  count: number;
  consumer_id: string;
  app_name: string;
  developer_email: string;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;
  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }
  const accessToken = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!accessToken) {
    throw error(401, "No API access token available");
  }

  const fromParam = url.searchParams.get("from_date");
  const toParam = url.searchParams.get("to_date");
  const fromValid = fromParam !== null && Number.isFinite(Date.parse(fromParam));
  const toValid = toParam !== null && Number.isFinite(Date.parse(toParam));
  if (!fromValid || !toValid) {
    return {
      window: null,
      consumers: [] as TopConsumerRow[],
      possiblyTruncated: false,
      expectedDistinct: null as number | null,
      fetchError: null as { httpStatus: number | null; message: string } | null,
    };
  }

  const windowQuery = new URLSearchParams({ from_date: fromParam!, to_date: toParam! });
  // The v7 top-consumers groups by metric.consumerid — the same basis as the dashboard
  // tile's distinct_consumer_count, so the two numbers must agree; the page shows the
  // comparison as an explicit consistency check.
  const topConsumersEndpoint = `/obp/v7.0.0/management/metrics/top-consumers?${windowQuery.toString()}&limit=${TOP_CONSUMERS_LIMIT}`;
  const aggregateEndpoint = `/obp/v6.0.0/management/aggregate-metrics?${windowQuery.toString()}`;

  const [topConsumersResult, aggregateResult] = await Promise.allSettled([
    obp_requests.get(topConsumersEndpoint, accessToken),
    obp_requests.get(aggregateEndpoint, accessToken),
  ]);

  let consumers: TopConsumerRow[] = [];
  let fetchError: { httpStatus: number | null; message: string } | null = null;
  if (topConsumersResult.status === "fulfilled") {
    const body = topConsumersResult.value;
    if (!Array.isArray(body?.top_consumers)) {
      fetchError = {
        httpStatus: null,
        message: `Unexpected top-consumers response shape: ${JSON.stringify(body).slice(0, 500)}`,
      };
    } else {
      consumers = body.top_consumers;
    }
  } else {
    const err = topConsumersResult.reason;
    logger.error("top-consumers fetch failed:", err);
    // Repo rule: never hide or simplify OBP error messages.
    fetchError = {
      httpStatus: err instanceof OBPRequestError ? (err.statusCode ?? null) : null,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  // The consistency reference degrades to absent on its own (different role).
  let expectedDistinct: number | null = null;
  if (aggregateResult.status === "fulfilled") {
    const metric = unwrapAggregateMetric(aggregateResult.value);
    if (metric && typeof metric.distinct_consumer_count === "number") {
      expectedDistinct = metric.distinct_consumer_count;
    }
  } else {
    logger.error("aggregate-metrics consistency fetch failed:", aggregateResult.reason);
  }

  return {
    window: { from: fromParam!, to: toParam! },
    consumers,
    possiblyTruncated: consumers.length >= TOP_CONSUMERS_LIMIT,
    expectedDistinct,
    fetchError,
  };
};
