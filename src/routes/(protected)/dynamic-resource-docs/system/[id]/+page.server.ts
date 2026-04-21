import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "$lib/utils/logger";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";

const logger = createLogger("SystemDynamicResourceDocDetailPageServer");

export const load: PageServerLoad = async ({ params, locals }) => {
  const session = locals.session;
  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;
  if (!accessToken) {
    throw error(401, "No API access token available");
  }

  const { id } = params;
  if (!id) {
    throw error(400, "Resource doc ID is required");
  }

  try {
    const doc = await obp_requests.get(
      `/obp/v4.0.0/management/dynamic-resource-docs/${encodeURIComponent(id)}`,
      accessToken,
    );
    if (!doc) {
      throw error(404, "Dynamic resource doc not found");
    }
    logger.debug(`Retrieved dynamic resource doc ${id}`);
    return { doc };
  } catch (err: any) {
    logger.error("Error fetching dynamic resource doc:", err);
    if (err && typeof err === "object" && "status" in err) throw err;
    throw error(
      500,
      err instanceof Error ? err.message : "Failed to fetch dynamic resource doc",
    );
  }
};
