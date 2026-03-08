import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";
import { createLogger } from "$lib/utils/logger";

const logger = createLogger("EditSystemViewServer");

export const load: PageServerLoad = async ({ locals, params }) => {
  const session = locals.session;
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const token = sessionOAuth?.accessToken;

  if (!token) {
    error(401, {
      message: "Unauthorized: No access token found in session.",
    });
  }

  const { view_id } = params;

  if (!view_id) {
    error(400, {
      message: "View ID is required",
    });
  }

  // Fetch the current system view
  let view = null;
  try {
    const endpoint = `/obp/v6.0.0/management/system-views/${view_id}`;
    view = await obp_requests.get(endpoint, token);
    logger.debug(`Retrieved system view: ${view.short_name}`);
  } catch (e) {
    logger.error("Error fetching system view:", e);
    error(500, {
      message: "Could not fetch system view at this time. Please try again later.",
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
      ([cat, perms]) => ({ category: cat, permissions: perms }),
    );

    logger.debug(
      `Retrieved ${permissions.length} view permissions in ${permissionsByCategory.length} categories`,
    );
  } catch (e) {
    logger.error("Error fetching view permissions:", e);
  }

  logger.debug("Edit system view page loaded");

  return {
    view,
    permissionsByCategory,
  };
};
