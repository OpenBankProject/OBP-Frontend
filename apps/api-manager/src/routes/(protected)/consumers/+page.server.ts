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

const logger = createLogger("ConsumersServer");

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
      hasApiAccess: false,
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
    const endpoint = `/obp/v6.0.0/management/consumers?limit=500&offset=0&from_date=${encodeURIComponent(fromDate)}${toDateSuffix}`;
    logger.info(`Request: ${endpoint}`);

    const consumersResponse = await obp_requests.get(endpoint, accessToken);

    consumers = consumersResponse?.consumers || [];
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

  return {
    consumers,
    createdWindow,
    hasApiAccess: true,
    error: errorMessage,
  };
}
