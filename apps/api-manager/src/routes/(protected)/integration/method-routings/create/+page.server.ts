import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;
  if (!session?.data?.user) throw error(401, "Unauthorized");
  if (!SessionOAuthHelper.getSessionOAuth(session)?.accessToken) throw error(401, "No API access token available");
  // ?method=NAME prefills an override of a default routing; ?from=ID duplicates a configured one.
  return { prefillMethod: url.searchParams.get("method") ?? "", prefillFromId: url.searchParams.get("from") ?? "" };
};
