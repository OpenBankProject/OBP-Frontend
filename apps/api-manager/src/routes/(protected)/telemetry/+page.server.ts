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
import type { TelemetryResponse } from "$lib/telemetry/telemetry";

const logger = createLogger("TelemetryPageServer");

export const load: PageServerLoad = async ({ locals, depends }) => {
  depends("app:telemetry");

  const session = locals.session;

  if (!session?.data?.user) {
    logger.error("No user in session");
    throw error(401, "Unauthorized");
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.error("No access token available");
    throw error(401, "No API access token available");
  }

  const userEntitlements =
    (session.data.user as any)?.entitlements?.list || [];

  const hasRole = userEntitlements.some(
    (ent: any) => ent.role_name === "CanGetTelemetry",
  );

  if (!hasRole) {
    logger.info("load says: user lacks CanGetTelemetry, skipping the Telemetry fetch");
    return { telemetry: null, hasRole: false, fetchedAt: null };
  }

  try {
    const telemetry: TelemetryResponse = await obp_requests.get(
      "/obp/v7.0.0/management/telemetry",
      accessToken,
    );
    return { telemetry, hasRole: true, fetchedAt: new Date().toISOString() };
  } catch (err: any) {
    logger.error("load says: error fetching Telemetry:", err);
    throw error(
      err?.status && Number.isInteger(err.status) ? err.status : 500,
      err instanceof Error ? err.message : "Failed to fetch Telemetry",
    );
  }
};
