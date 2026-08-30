import { createLogger } from "@obp/shared/utils";
const logger = createLogger("UserDetailPageServer");
import type { PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { getPortalUrl } from "$lib/obp/appDirectory";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { error } from "@sveltejs/kit";

interface UserDetail {
  user_id: string;
  username: string;
  email: string;
  provider: string;
  created_date: string;
  last_activity_date?: string;
  recent_operation_ids?: string[];
  last_login_date?: string;
  is_locked?: boolean;
  is_deleted?: boolean;
  email_validated?: boolean;
  // v7.0.0: the user's own (global, OBP-verified) mobile number — distinct from
  // the bank-scoped Customer.mobile_phone_number KYC field.
  mobile_phone_number?: string;
  mobile_phone_number_is_validated?: boolean;
  mobile_phone_number_validated_date?: string;
  entitlements?: any;
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  const { user_id } = params;

  if (!user_id) {
    throw error(400, "User ID is required");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for user detail API call");
    return {
      user: null,
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  let user: UserDetail | null = null;

  try {
    // Fetch user details from OBP API using user_id endpoint.
    // v7.0.0 adds mobile_phone_number{,_is_validated,_validated_date}.
    logger.info("=== USER DETAIL API CALL ===");
    const endpoint = `/obp/v7.0.0/users/user-id/${encodeURIComponent(user_id)}`;
    logger.info(`Request: ${endpoint}`);

    const response = await obp_requests.get(endpoint, accessToken);

    logger.info(`Response: User ${user_id}`);

    if (response) {
      user = response;
    } else {
      logger.warn("NO USER DATA IN RESPONSE");
      return {
        user: null,
        user_id,
        hasApiAccess: true,
        error: "User not found",
      };
    }
  } catch (err) {
    logger.error("ERROR FETCHING USER DETAIL:");
    logger.error(`  Error type: ${err?.constructor?.name}`);
    logger.error(
      `  Error message: ${err instanceof Error ? err.message : String(err)}`,
    );

    return {
      user: null,
      user_id,
      hasApiAccess: false,
      error: err instanceof Error ? err.message : "Failed to load user details",
    };
  }

  return {
    user,
    user_id,
    hasApiAccess: true,
    // Enables the "Chat" button linking to the Portal's DM deep link
    portalUrl: await getPortalUrl(),
  };
};
