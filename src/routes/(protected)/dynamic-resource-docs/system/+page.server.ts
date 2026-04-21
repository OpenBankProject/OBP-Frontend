import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "$lib/utils/logger";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { obp_requests } from "$lib/obp/requests";

const logger = createLogger("SystemDynamicResourceDocsPageServer");

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    throw error(401, "No API access token available");
  }

  try {
    const resp = await obp_requests.get(
      `/obp/v4.0.0/management/dynamic-resource-docs`,
      accessToken,
    );
    const docs = resp?.["dynamic-resource-docs"] || [];
    logger.info(`Retrieved ${docs.length} system dynamic resource docs`);
    return { docs };
  } catch (err: any) {
    logger.error("Error fetching system dynamic resource docs:", err);
    return {
      docs: [],
      error:
        err instanceof Error
          ? err.message
          : "Failed to fetch system dynamic resource docs",
    };
  }
};
