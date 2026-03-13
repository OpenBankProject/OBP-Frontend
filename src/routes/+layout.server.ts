import { createLogger } from "$lib/utils/logger";
const logger = createLogger("LayoutServer");
import type { RequestEvent } from "@sveltejs/kit";
import { obpIntegrationService } from "$lib/server/opey/OBPIntegrationService";
import type { OBPConsentInfo } from "$lib/obp/types";
// import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
// import { storePopup } from '@skeletonlabs/skeleton';
// storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });

import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";


export interface RootLayoutData {
  userId?: string;
  email?: string;
  username?: string;
  opeyConsentInfo?: OBPConsentInfo;
  externalLinks: Record<string, string>;
  userEntitlements: Array<{ entitlement_id: string; role_name: string; bank_id: string }>;
}

export async function load(event: RequestEvent) {
  const startTime = performance.now();
  logger.info("🚀 Layout server load started");

  const { session } = event.locals;

  let data: Partial<RootLayoutData> = {};

  let externalLinks = {
    API_EXPLORER_URL:
      env.API_EXPLORER_URL ||
      "https://apiexplorer-ii-sandbox.openbankproject.com",
    API_MANAGER_URL: env.API_MANAGER_URL,
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

  return {
    ...data,
    externalLinks: validExternalLinks,
    userEntitlements,
  } as RootLayoutData;
}
