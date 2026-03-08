import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "$lib/utils/logger";
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";

const logger = createLogger("CustomViewsPageServer");

interface CustomView {
  view_id: string;
  short_name: string;
  description: string;
  is_public: boolean;
  alias?: string;
  hide_metadata_if_alias_used?: boolean;
}

interface ViewsResponse {
  views: CustomView[];
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
    logger.warn("No access token available for custom views page");
    return {
      views: [],
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    logger.info("=== FETCHING CUSTOM VIEWS ===");
    const endpoint = `/obp/v6.0.0/management/custom-views`;
    logger.info(`Request: ${endpoint}`);

    const response: ViewsResponse = await obp_requests.get(
      endpoint,
      accessToken,
    );

    logger.info(`Response received with ${response.views?.length || 0} views`);

    if (response.views) {
      logger.info(`First view sample: ${JSON.stringify(response.views[0])}`);
    }

    return {
      views: response.views || [],
      hasApiAccess: true,
    };
  } catch (err) {
    logger.error("Error loading custom views:", err);
    logger.error(
      `Error message: ${err instanceof Error ? err.message : String(err)}`,
    );

    return {
      views: [],
      hasApiAccess: true,
      error: err instanceof Error ? err.message : "Failed to load custom views",
    };
  }
};
