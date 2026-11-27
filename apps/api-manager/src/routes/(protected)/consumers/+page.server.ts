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
import { createLogger } from "@obp/shared/utils";
import { obp_requests } from "$lib/obp/requests";
import { error } from "@sveltejs/kit";
import type { OBPConsumer } from "$lib/obp/types";
import type { RequestEvent } from "@sveltejs/kit";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { getPortalUrl } from "$lib/obp/appDirectory";
import { explorerResourceDocUrl } from "$lib/server/glossaryCache";
import { fetchPlatformApps } from "$lib/server/platformApps";

const logger = createLogger("ConsumersServer");

/** The endpoints behind this page, linked to their resource docs in the API Explorer. */
const ENDPOINTS = [
  { operation_id: "OBPv7.0.0-getConsumers", verb: "GET", path: "/obp/v7.0.0/management/consumers" },
  {
    operation_id: "OBPv7.0.0-getConsumerLastCalls",
    verb: "GET",
    path: "/obp/v7.0.0/management/metrics/consumer-last-calls",
  },
  { operation_id: "OBPv7.0.0-getPlatformApps", verb: "GET", path: "/obp/v7.0.0/management/platform-apps" },
];

/** Seeing which Consumers are Platform Apps needs this Role. */
const PLATFORM_APPS_ROLE = "CanGetPlatformApps";
const explorerEndpoints = () => ENDPOINTS.map((e) => ({ ...e, url: explorerResourceDocUrl(e.operation_id) }));

export async function load(event: RequestEvent) {
  const session = event.locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for consumers API calls");
    return {
      consumers: [],
      endpoints: explorerEndpoints(),
      hasApiAccess: false,
      platformApps: null,
      platformAppsError: null,
      platformAppsRole: PLATFORM_APPS_ROLE,
      canGetPlatformApps: false,
      error: "No API access token available",
    };
  }

  let consumers: OBPConsumer[] = [];
  let errorMessage: string | null = null;

  // Optional created-date window (used by the Dashboard's "New consumers" drill-down).
  // The OBP endpoint filters on the consumer's creation date natively.
  const fromParam = event.url.searchParams.get("from_date");
  const toParam = event.url.searchParams.get("to_date");
  const fromValid = fromParam !== null && Number.isFinite(Date.parse(fromParam));
  const toValid = toParam !== null && Number.isFinite(Date.parse(toParam));
  const createdWindow = fromValid && toValid ? { from: fromParam!, to: toParam! } : null;

  try {
    logger.info("=== GET ALL CONSUMERS API CALL ===");
    const fromDate = createdWindow ? createdWindow.from : "1970-01-01T00:00:00.000Z";
    const toDateSuffix = createdWindow ? `&to_date=${encodeURIComponent(createdWindow.to)}` : "";
    const endpoint = `/obp/v7.0.0/management/consumers?limit=500&offset=0&from_date=${encodeURIComponent(fromDate)}${toDateSuffix}`;
    logger.info(`Request: ${endpoint}`);

    const consumersResponse = await obp_requests.get(endpoint, accessToken);

    // v7 has no consumer_key; an older OBP-API bridges this path to v5.1.0, which may still carry it.
    // The key is a credential: it never reaches the browser, consumers are referenced by consumer_id.
    consumers = (consumersResponse?.consumers || []).map(
      ({ consumer_key, ...consumer }: OBPConsumer & { consumer_key?: string }) => consumer,
    );
    logger.info(`Response: ${consumers.length} consumers`);
  } catch (e: any) {
    logger.error("Error fetching consumers:", e);
    errorMessage =
      e?.message || "Could not fetch consumers. Please try again later.";
  }

  // Sort consumers by created date, most recent first
  consumers.sort((a: OBPConsumer, b: OBPConsumer) => {
    const dateA = a.created ? new Date(a.created).getTime() : 0;
    const dateB = b.created ? new Date(b.created).getTime() : 0;
    return dateB - dateA; // Most recent first
  });

  // Last call dates need CanReadMetrics; without it the page leaves them out.
  const entitlements = (session.data.user as any)?.entitlements?.list || [];
  const canReadMetrics = entitlements.some(
    (entitlement: any) => entitlement.role_name === "CanReadMetrics",
  );

  // One Redis-backed read for every consumer. Extra information: any failure leaves it out.
  let consumerLastCalls: { trackedSince: string | null; lastCalls: Record<string, string> } | null = null;
  if (canReadMetrics) {
    try {
      const response = await obp_requests.get(
        "/obp/v7.0.0/management/metrics/consumer-last-calls",
        accessToken,
      );
      consumerLastCalls = {
        trackedSince: response.tracked_since ?? null,
        lastCalls: Object.fromEntries(
          (response.consumer_last_calls ?? []).map((row: any) => [row.consumer_id, row.last_call_at]),
        ),
      };
    } catch (e) {
      logger.warn("Could not read consumer last calls:", e);
    }
  }

  // Which Consumers are Platform Apps, by consumer_id. Null when the user lacks the Role or OBP-API could not
  // answer: the page then says the status is unknown rather than suggesting no Consumer is a Platform App.
  const canGetPlatformApps = entitlements.some(
    (entitlement: any) => entitlement.role_name === PLATFORM_APPS_ROLE,
  );
  let platformApps: Record<string, { label: string; state: string }> | null = null;
  let platformAppsError: string | null = null;
  if (canGetPlatformApps) {
    const result = await fetchPlatformApps(accessToken);
    if (result.error) {
      logger.warn("Could not read the Platform Apps:", result.error);
      platformAppsError = result.error;
    } else {
      platformApps = Object.fromEntries(
        result.apps.map((app) => [app.consumer_id, { label: app.label, state: app.state }]),
      );
    }
  }

  return {
    consumers,
    consumerLastCalls,
    platformApps,
    platformAppsError,
    platformAppsRole: PLATFORM_APPS_ROLE,
    canGetPlatformApps,
    endpoints: explorerEndpoints(),
    createdWindow,
    portalUrl: await getPortalUrl(),
    hasApiAccess: true,
    error: errorMessage,
  };
}
