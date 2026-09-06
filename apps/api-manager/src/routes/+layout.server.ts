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
const logger = createLogger("LayoutServer");
import type { ServerLoadEvent } from "@sveltejs/kit";
import type { Session } from "svelte-kit-sessions";
import { obpIntegrationService } from "$lib/server/opey/OBPIntegrationService";
import { OBP_API_URL } from "$lib/config";
import type { OBPConsentInfo } from "$lib/obp/types";
// import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
// import { storePopup } from '@skeletonlabs/skeleton';
// storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });

import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import { obp_requests } from "$lib/obp/requests";


export interface RootLayoutData {
  userId?: string;
  email?: string;
  username?: string;
  opeyConsentInfo?: OBPConsentInfo;
  externalLinks: Record<string, string>;
  userEntitlements: Array<{ entitlement_id: string; role_name: string; bank_id: string }>;
  jitEnabled: boolean;
}

// Session user (incl. entitlements) is a login-time snapshot. Refresh it from
// /users/current when older than this, so granted roles (manual or JIT) show up
// without logout/login. The client layout re-polls via invalidate() every 5 min;
// keeping the base threshold below the poll interval guarantees each poll refreshes.
// Users with very large entitlement lists (JIT accumulation can reach thousands of
// rows) get a several-hundred-KB /users/current response, so back off for them —
// see security_TODO.md "Prune JIT-accumulated entitlements".
const USER_REFRESH_STALE_MS = 4 * 60 * 1000;
const USER_REFRESH_STALE_LARGE_MS = 15 * 60 * 1000;
const LARGE_ENTITLEMENT_COUNT = 500;

async function refreshSessionUser(session: Session) {
  const lastRefresh = session.data.userRefreshedAt ?? 0;
  const entitlementCount =
    (session.data.user as any)?.entitlements?.list?.length ?? 0;
  const staleMs =
    entitlementCount > LARGE_ENTITLEMENT_COUNT
      ? USER_REFRESH_STALE_LARGE_MS
      : USER_REFRESH_STALE_MS;
  if (Date.now() - lastRefresh < staleMs) return;

  try {
    const response = await fetch(`${OBP_API_URL}/users/current`, {
      headers: { Authorization: `Bearer ${session.data.oauth!.access_token}` },
    });
    if (!response.ok) {
      logger.warn(`Failed to refresh /users/current: ${response.status}`);
      return;
    }
    const freshUser = await response.json();
    if (!freshUser.user_id) {
      logger.warn("Refresh of /users/current returned no user_id, keeping session user");
      return;
    }
    await session.setData({
      ...session.data,
      user: freshUser,
      userRefreshedAt: Date.now(),
    });
    await session.save();
    logger.info(
      `Refreshed session user from /users/current (${freshUser.entitlements?.list?.length ?? 0} entitlements)`,
    );
  } catch (error) {
    logger.warn("Failed to refresh /users/current, keeping session user:", error);
  }
}

export async function load(event: ServerLoadEvent) {
  const startTime = performance.now();
  logger.info("🚀 Layout server load started");

  // Rerun this load (and dependants) when the client calls invalidate("app:session-user")
  event.depends("app:session-user");

  const { session } = event.locals;

  let data: Partial<RootLayoutData> = {};

  let externalLinks = {
    API_EXPLORER_URL:
      env.API_EXPLORER_URL ||
      "https://apiexplorer-ii-sandbox.openbankproject.com",
    SUBSCRIPTIONS_URL: publicEnv.PUBLIC_SUBSCRIPTIONS_URL,
    LEGACY_PORTAL_URL: publicEnv.PUBLIC_LEGACY_PORTAL_URL,
    PORTAL_URL: publicEnv.PUBLIC_PORTAL_URL || "http://localhost:5174",
  };

  // Filter out undefined/null values and warn about missing ones
  logger.info("📋 Processing external links configuration");
  const validExternalLinks: Record<string, string> = {};
  Object.entries(externalLinks).forEach(([name, url]) => {
    if (!url) {
      logger.warn(
        `Environment variable ${name} is not set, it will not show up in the menu.`,
      );
    } else {
      validExternalLinks[name] = url;
    }
  });
  logger.info(
    `✅ External links processed: ${Object.keys(validExternalLinks).length} links configured`,
  );

  // Get information about the user from the session if they are logged in
  // User is only considered logged in if they have both user data AND a valid access token
  logger.info("👤 Checking user session");
  if (session?.data?.user && session?.data?.oauth?.access_token) {
    await refreshSessionUser(session);
    data.userId = session.data.user.user_id;
    data.email = session.data.user.email;
    data.username = session.data.user.username;
    logger.info(`✅ User session found: ${data.email}`);
  } else {
    logger.info("ℹ️  No user session found (user not logged in or no access token)");
  }

  // Get Opey consent info if we have Opey consumer ID configured
  logger.info("🔐 Fetching Opey consent info");
  const consentStartTime = performance.now();
  try {
    const currentConsentInfo =
      await obpIntegrationService.getCurrentConsentInfo(session);
    const consentEndTime = performance.now();
    logger.info(
      `✅ Opey consent info fetched in ${(consentEndTime - consentStartTime).toFixed(2)}ms`,
    );
    if (currentConsentInfo) {
      data.opeyConsentInfo = currentConsentInfo;
      logger.info(
        `✅ Consent info available: status=${currentConsentInfo.status}`,
      );
    } else {
      logger.info("ℹ️  No consent info available");
    }
  } catch (error) {
    const consentEndTime = performance.now();
    logger.error(
      `❌ Error fetching Opey consent info after ${(consentEndTime - consentStartTime).toFixed(2)}ms:`,
      error,
    );
  }

  const endTime = performance.now();
  const totalTime = endTime - startTime;
  logger.info(`✅ Layout server load completed in ${totalTime.toFixed(2)}ms`);

  const userEntitlements =
    (session?.data?.user as any)?.entitlements?.list || [];

  // Fetch OBP features to check if JIT entitlements are enabled
  let jitEnabled = false;
  try {
    const features = await obp_requests.get("/obp/v6.0.0/features");
    jitEnabled = features.allow_just_in_time_entitlements === true;
    logger.info(`JIT entitlements: ${jitEnabled ? "enabled" : "disabled"}`);
  } catch (error) {
    logger.warn("Failed to fetch OBP features, JIT entitlements assumed disabled:", error);
  }

  return {
    ...data,
    externalLinks: validExternalLinks,
    userEntitlements,
    jitEnabled,
  } as RootLayoutData;
}
