import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "$lib/utils/logger";
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";

const logger = createLogger("CreateCustomViewPageServer");

interface ViewPermission {
  permission: string;
  category: string;
}

interface ViewPermissionsResponse {
  permissions: ViewPermission[];
}

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for create custom view page");
    return {
      hasApiAccess: false,
      permissionsByCategory: [],
      error: "No API access token available",
    };
  }

  try {
    const endpoint = `/obp/v6.0.0/management/view-permissions`;
    logger.info(`Fetching view permissions from ${endpoint}`);

    const response: ViewPermissionsResponse = await obp_requests.get(
      endpoint,
      accessToken,
    );

    // Group permissions by category
    const categoryMap = new Map<string, string[]>();
    for (const p of response.permissions) {
      const perms = categoryMap.get(p.category) || [];
      perms.push(p.permission);
      categoryMap.set(p.category, perms);
    }

    const permissionsByCategory = Array.from(categoryMap.entries()).map(
      ([category, permissions]) => ({ category, permissions }),
    );

    logger.info(
      `Loaded ${response.permissions.length} permissions in ${permissionsByCategory.length} categories`,
    );

    return {
      hasApiAccess: true,
      permissionsByCategory,
    };
  } catch (err) {
    logger.error("Error loading view permissions:", err);

    return {
      hasApiAccess: true,
      permissionsByCategory: [],
      error: err instanceof Error ? err.message : "Failed to load view permissions",
    };
  }
};
