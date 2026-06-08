import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "@obp/shared/utils";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";

const logger = createLogger("MetricsDiagnosticsPageServer");

export const load: PageServerLoad = async ({ locals, depends }) => {
  depends("app:metrics-diagnostics");
  logger.info("=== Metrics Diagnostics Page Load Started ===");

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
    (ent: any) => ent.role_name === "CanGetMetricsDiagnostics",
  );

  if (!hasRole) {
    logger.info(
      "User lacks CanGetMetricsDiagnostics role, skipping diagnostics fetch",
    );
    return {
      diagnostics: null,
      hasRole: false,
      userEntitlements,
    };
  }

  try {
    const endpoint = "/obp/v7.0.0/management/system/diagnostics/metrics";
    logger.info(`Making API request to: ${endpoint}`);

    const diagnostics = await obp_requests.get(endpoint, accessToken);

    return {
      diagnostics,
      hasRole: true,
      userEntitlements,
    };
  } catch (err: any) {
    logger.error("Error fetching metrics diagnostics:", err);
    throw error(
      err?.status && Number.isInteger(err.status) ? err.status : 500,
      err instanceof Error ? err.message : "Failed to fetch metrics diagnostics",
    );
  }
};
