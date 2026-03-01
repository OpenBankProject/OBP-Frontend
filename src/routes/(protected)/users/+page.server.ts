import { createLogger } from "$lib/utils/logger";
const logger = createLogger("UsersPageServer");
import type { PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { error } from "@sveltejs/kit";

interface User {
  user_id: string;
  username: string;
  email: string;
  provider: string;
  created_date: string;
  entitlements?: any[];
}

interface UsersResponse {
  users: User[];
  count: number;
  error?: string;
}

export const load: PageServerLoad = async ({ locals, url }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  // Get the OAuth session data
  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for users API calls");
    return {
      users: null,
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    // Fetch users from OBP API - get recent users with pagination
    logger.info("=== USERS API CALL ===");
    const role = url.searchParams.get("role_name");
    let endpoint = `/obp/v6.0.0/users?limit=100`;
    if (role) {
      endpoint += `&role_name=${encodeURIComponent(role)}`;
    }
    logger.info(`Request: ${endpoint}`);

    const response = await obp_requests.get(endpoint, accessToken);

    if (response?.users) {
      logger.info(`Retrieved ${response.users.length} users from OBP API`);

      // Sort users by created_date descending (most recent first)
      const sortedUsers = response.users.sort((a: User, b: User) => {
        const dateA = new Date(a.created_date || 0).getTime();
        const dateB = new Date(b.created_date || 0).getTime();
        return dateB - dateA; // Descending order
      });

      return {
        users: sortedUsers,
        hasApiAccess: true,
      };
    } else {
      logger.warn("NO USERS DATA IN RESPONSE");
      return {
        users: [],
        hasApiAccess: true,
        error: "No users data found in API response",
      };
    }
  } catch (err) {
    logger.error("ERROR FETCHING USERS:");
    logger.error(`  Error type: ${err?.constructor?.name}`);
    logger.error(
      `  Error message: ${err instanceof Error ? err.message : String(err)}`,
    );
    logger.error(
      `  Error stack: ${err instanceof Error ? err.stack : "No stack trace"}`,
    );

    return {
      users: [],
      hasApiAccess: true,
      error: err instanceof Error ? err.message : "Failed to load users",
    };
  }
};
