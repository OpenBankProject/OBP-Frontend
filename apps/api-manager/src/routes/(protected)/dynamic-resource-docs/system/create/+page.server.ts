import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { loadDynamicCodeApprovalConfig } from "$lib/server/dynamicCodeApproval";

export const load: PageServerLoad = async ({ locals }) => {
  const session = locals.session;
  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  if (!sessionOAuth?.accessToken) {
    throw error(401, "No API access token available");
  }
  const approval = await loadDynamicCodeApprovalConfig(sessionOAuth.accessToken);
  return { approval };
};
