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
import {
  ACTIVITY_WINDOWS,
  ACTIVITY_CREATED_WINDOW_KEYS,
  activityWindowDefs,
  snapAsOf,
  windowFor,
  comparisonWindowFor,
  aggregateMetricsQuery,
  oldestNeededFrom,
  countCreatedWithin,
  buildWindowRow,
  unwrapAggregateMetric,
  formatObpDate,
} from "@obp/shared/obp";
import type {
  ActivityWindow,
  ActivityWindowDef,
  ActivityWindowRow,
  OBPAggregateMetric,
} from "@obp/shared/obp";

const logger = createLogger("DashboardPageServer");

const AGGREGATE_ROLE = "CanReadAggregateMetrics";
const USERS_ROLE = "CanGetAnyUser";
const CONSUMERS_ROLE = "CanGetConsumers";

const CONSUMERS_PAGE_LIMIT = 500;
const CONSUMERS_MAX_PAGES = 8;
const USERS_PAGE_LIMIT = 200;
const USERS_MAX_PAGES = 5;

export interface DashboardRowsTile {
  status: "ok";
  rows: ActivityWindowRow[];
  /** True when paging stopped at the safety cap, so counts are lower bounds. */
  truncated?: boolean;
}
export interface DashboardTileError {
  status: "error";
  httpStatus: number | null;
  message: string;
  role: string;
}
export interface DashboardTileUnavailable {
  status: "unavailable";
  message: string;
}
export type DashboardTile =
  | DashboardRowsTile
  | DashboardTileError
  | DashboardTileUnavailable;

export interface ConsentTrafficRow extends ActivityWindowRow {
  /** consent calls as a share of all calls in the window, null when there were no calls. */
  shareOfTotalPct: number | null;
  activeConsents: number;
}
export interface ConsentTrafficTile {
  status: "ok";
  rows: ConsentTrafficRow[];
}
export type ConsentTile =
  | ConsentTrafficTile
  | DashboardTileError
  | DashboardTileUnavailable;

function tileError(err: unknown, role: string): DashboardTileError {
  // Repo rule: never hide or simplify OBP error messages.
  if (err instanceof OBPRequestError) {
    return {
      status: "error",
      httpStatus: err.statusCode ?? null,
      message: err.message,
      role,
    };
  }
  return {
    status: "error",
    httpStatus: null,
    message: err instanceof Error ? err.message : String(err),
    role,
  };
}

interface WindowPair {
  def: ActivityWindowDef;
  current: ActivityWindow;
  comparison: ActivityWindow;
}

function windowPairs(
  asOf: Date,
  defs: readonly ActivityWindowDef[],
): WindowPair[] {
  return defs.map((def) => {
    const current = windowFor(asOf, def.ms);
    return {
      def,
      current,
      comparison: comparisonWindowFor(current, def.compare),
    };
  });
}

export const load: PageServerLoad = async ({ locals, depends }) => {
  depends("app:system-activity-dashboard");

  const session = locals.session;
  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }
  const accessToken = SessionOAuthHelper.getSessionOAuth(session)?.accessToken;
  if (!accessToken) {
    throw error(401, "No API access token available");
  }

  // ONE snapped instant for every window: lagged behind OBP's stable-cache boundary and
  // floored to 5-minute marks, so repeated loads hit OBP's 24h query cache instead of the
  // database. See packages/shared/src/lib/obp/activitySummary.ts for the full rationale.
  const asOf = snapAsOf(new Date());
  const oldestNeeded = oldestNeededFrom(asOf);

  async function fetchAggregate(
    win: ActivityWindow,
  ): Promise<OBPAggregateMetric> {
    const endpoint = `/obp/v6.0.0/management/aggregate-metrics?${aggregateMetricsQuery(win).toString()}`;
    const body = await obp_requests.get(endpoint, accessToken);
    const metric = unwrapAggregateMetric(body);
    if (!metric) {
      throw new Error(
        `Unexpected aggregate-metrics response shape: ${JSON.stringify(body)}`,
      );
    }
    return metric;
  }

  // ── Group 1: aggregate-metrics (API calls, active users, active consumers, consent traffic)
  async function aggregateTiles(): Promise<{
    apiCalls: DashboardTile;
    activeUsers: DashboardTile;
    activeConsumers: DashboardTile;
    consentTraffic: ConsentTile;
  }> {
    const pairs = windowPairs(asOf, ACTIVITY_WINDOWS);
    const settled = await Promise.allSettled(
      pairs.flatMap((p) => [
        fetchAggregate(p.current),
        fetchAggregate(p.comparison),
      ]),
    );

    const currents: (OBPAggregateMetric | null)[] = [];
    const comparisons: (OBPAggregateMetric | null)[] = [];
    let firstError: unknown = null;
    settled.forEach((result, i) => {
      const bucket = i % 2 === 0 ? currents : comparisons;
      if (result.status === "fulfilled") {
        bucket.push(result.value);
      } else {
        bucket.push(null);
        if (firstError === null) firstError = result.reason;
        logger.error(
          `aggregate-metrics ${i % 2 === 0 ? "current" : "comparison"} window failed:`,
          result.reason,
        );
      }
    });

    // A current-window failure makes every aggregate-derived tile wrong, not just one row.
    if (currents.some((m) => m === null)) {
      const err = tileError(firstError, AGGREGATE_ROLE);
      return {
        apiCalls: err,
        activeUsers: err,
        activeConsumers: err,
        consentTraffic: err,
      };
    }

    const apiCalls: DashboardTile = {
      status: "ok",
      rows: pairs.map((p, i) =>
        buildWindowRow(
          p.def,
          currents[i]!.count,
          comparisons[i]?.count ?? null,
        ),
      ),
    };

    // The distinct/consent fields exist only on OBP-API builds with the v6.0.0
    // distinct-counts change. Absent means the backend predates it — say so, show no zeros.
    if (currents.some((m) => typeof m!.distinct_user_count !== "number")) {
      const unavailable: DashboardTileUnavailable = {
        status: "unavailable",
        message:
          "This OBP-API instance does not return distinct counts on aggregate-metrics. " +
          "Active users, active consumers and consent traffic need an OBP-API with the " +
          "v6.0.0 distinct-counts fields (distinct_user_count etc.).",
      };
      return {
        apiCalls,
        activeUsers: unavailable,
        activeConsumers: unavailable,
        consentTraffic: unavailable,
      };
    }

    const activeUsers: DashboardTile = {
      status: "ok",
      rows: pairs.map((p, i) =>
        buildWindowRow(
          p.def,
          currents[i]!.distinct_user_count!,
          comparisons[i]?.distinct_user_count ?? null,
        ),
      ),
    };
    const activeConsumers: DashboardTile = {
      status: "ok",
      rows: pairs.map((p, i) =>
        buildWindowRow(
          p.def,
          currents[i]!.distinct_consumer_count!,
          comparisons[i]?.distinct_consumer_count ?? null,
        ),
      ),
    };
    const consentTraffic: ConsentTile = {
      status: "ok",
      rows: pairs.map((p, i) => {
        const current = currents[i]!;
        const row = buildWindowRow(
          p.def,
          current.consent_call_count!,
          comparisons[i]?.consent_call_count ?? null,
        );
        return {
          ...row,
          shareOfTotalPct:
            current.count > 0
              ? (current.consent_call_count! / current.count) * 100
              : null,
          activeConsents: current.distinct_consent_count!,
        };
      }),
    };
    return { apiCalls, activeUsers, activeConsumers, consentTraffic };
  }

  // ── Group 2: new consumers (date-filterable endpoint; count rows client-side per window)
  async function newConsumersTile(): Promise<DashboardTile> {
    interface ConsumerRow {
      created: string;
    }
    try {
      const consumers: ConsumerRow[] = [];
      let truncated = false;
      for (let page = 0; ; page++) {
        if (page >= CONSUMERS_MAX_PAGES) {
          truncated = true;
          break;
        }
        const query = new URLSearchParams({
          from_date: formatObpDate(oldestNeeded),
          to_date: formatObpDate(asOf),
          limit: String(CONSUMERS_PAGE_LIMIT),
          offset: String(page * CONSUMERS_PAGE_LIMIT),
        });
        const body = await obp_requests.get(
          `/obp/v5.1.0/management/consumers?${query.toString()}`,
          accessToken,
        );
        if (!Array.isArray(body?.consumers)) {
          throw new Error(
            `Unexpected consumers response shape: ${JSON.stringify(body).slice(0, 500)}`,
          );
        }
        consumers.push(...body.consumers);
        if (body.consumers.length < CONSUMERS_PAGE_LIMIT) break;
      }
      const defs = activityWindowDefs(ACTIVITY_CREATED_WINDOW_KEYS);
      return {
        status: "ok",
        truncated,
        rows: windowPairs(asOf, defs).map((p) =>
          buildWindowRow(
            p.def,
            countCreatedWithin(consumers, (c) => c.created, p.current),
            countCreatedWithin(consumers, (c) => c.created, p.comparison),
          ),
        ),
      };
    } catch (err) {
      logger.error("consumers fetch failed:", err);
      return tileError(err, CONSUMERS_ROLE);
    }
  }

  // ── Group 3: new users (no date filter on GET /users; page newest-first until past the
  // oldest window we need, counting client-side on created_date)
  async function newUsersTile(): Promise<DashboardTile> {
    interface UserRow {
      created_date: string;
    }
    try {
      const users: UserRow[] = [];
      let truncated = false;
      for (let page = 0; ; page++) {
        if (page >= USERS_MAX_PAGES) {
          truncated = true;
          break;
        }
        const query = new URLSearchParams({
          sort_by: "created_date",
          sort_direction: "desc",
          limit: String(USERS_PAGE_LIMIT),
          offset: String(page * USERS_PAGE_LIMIT),
        });
        const body = await obp_requests.get(
          `/obp/v6.0.0/users?${query.toString()}`,
          accessToken,
        );
        if (!Array.isArray(body?.users)) {
          throw new Error(
            `Unexpected users response shape: ${JSON.stringify(body).slice(0, 500)}`,
          );
        }
        users.push(...body.users);
        if (body.users.length < USERS_PAGE_LIMIT) break;
        const oldestOnPage = Date.parse(
          body.users[body.users.length - 1].created_date,
        );
        if (
          Number.isFinite(oldestOnPage) &&
          oldestOnPage < oldestNeeded.getTime()
        )
          break;
      }
      const defs = activityWindowDefs(ACTIVITY_CREATED_WINDOW_KEYS);
      return {
        status: "ok",
        truncated,
        rows: windowPairs(asOf, defs).map((p) =>
          buildWindowRow(
            p.def,
            countCreatedWithin(users, (u) => u.created_date, p.current),
            countCreatedWithin(users, (u) => u.created_date, p.comparison),
          ),
        ),
      };
    } catch (err) {
      logger.error("users fetch failed:", err);
      return tileError(err, USERS_ROLE);
    }
  }

  const [aggregate, newConsumers, newUsers] = await Promise.all([
    aggregateTiles(),
    newConsumersTile(),
    newUsersTile(),
  ]);

  return {
    asOf: asOf.toISOString(),
    tiles: {
      apiCalls: aggregate.apiCalls,
      activeUsers: aggregate.activeUsers,
      activeConsumers: aggregate.activeConsumers,
      consentTraffic: aggregate.consentTraffic,
      newUsers,
      newConsumers,
    },
  };
};
