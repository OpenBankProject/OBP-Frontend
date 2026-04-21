import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;
  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  if (!sessionOAuth?.accessToken) {
    throw error(401, "No API access token available");
  }
  return {};
};
