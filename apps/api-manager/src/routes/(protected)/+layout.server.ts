import type { LayoutServerLoad } from "./$types";

// Derive from the root layout load (rather than reading the session directly) so
// this load reruns when invalidate("app:session-user") refreshes the session user.
export const load: LayoutServerLoad = async ({ parent }) => {
  const { userEntitlements, userId } = await parent();
  return { userEntitlements: userEntitlements || [], userId: userId || "" };
};
