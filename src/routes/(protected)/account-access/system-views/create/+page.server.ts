import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { createLogger } from "$lib/utils/logger";

const logger = createLogger("CreateSystemViewServer");

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const token = sessionOAuth?.accessToken;

  if (!token) {
    error(401, {
      message: "Unauthorized: No access token found in session.",
    });
  }

  // Fetch available view permissions from OBP API, grouped by category
  let permissionsByCategory: { category: string; permissions: string[] }[] = [];
  try {
    const response = await obp_requests.get(
      "/obp/v6.0.0/management/view-permissions",
      token,
    );

    const permissions = response.permissions || [];
    const categoryMap = new Map<string, string[]>();
    for (const p of permissions) {
      const name = typeof p === "object" ? (p.permission || p.name) : p;
      const category = typeof p === "object" ? (p.category || "Other") : "Other";
      const perms = categoryMap.get(category) || [];
      perms.push(name);
      categoryMap.set(category, perms);
    }

    permissionsByCategory = Array.from(categoryMap.entries()).map(
      ([category, perms]) => ({ category, permissions: perms }),
    );

    logger.debug(
      `Retrieved ${permissions.length} view permissions in ${permissionsByCategory.length} categories`,
    );
  } catch (e) {
    logger.error("Error fetching view permissions:", e);
  }

  logger.debug("Create system view page loaded");

  return {
    permissionsByCategory,
  };
};
