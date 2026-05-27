import { createLogger } from "@obp/shared/utils";
const logger = createLogger("ValidateEmailPageServer");
import type { PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { extractErrorDetails } from "$lib/obp/errors";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { error, fail } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ locals, params }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  const { user_id } = params;

  if (!user_id) {
    throw error(400, "User ID is required");
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for validate-email page");
    return {
      user: null,
      user_id,
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  let user = null;
  try {
    const endpoint = `/obp/v6.0.0/users/user-id/${encodeURIComponent(user_id)}`;
    user = await obp_requests.get(endpoint, accessToken);
  } catch (err) {
    logger.error(
      `Error fetching user details: ${err instanceof Error ? err.message : String(err)}`,
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
  };
};

export const actions = {
  resendValidationEmail: async (event: RequestEvent) => {
    const session = event.locals.session;

    if (!session?.data?.user) {
      return fail(401, { error: "Unauthorized", action: "resendValidationEmail" });
    }

    const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
    const token = sessionOAuth?.accessToken;

    if (!token) {
      return fail(401, {
        error: "Unauthorized: No access token found in session.",
        action: "resendValidationEmail",
      });
    }

    const { user_id } = event.params;

    if (!user_id) {
      return fail(400, { error: "User ID is required.", action: "resendValidationEmail" });
    }

    let user;
    try {
      const endpoint = `/obp/v6.0.0/users/user-id/${encodeURIComponent(user_id)}`;
      user = await obp_requests.get(endpoint, token);
    } catch (e: any) {
      logger.error("Error fetching user for validation-email resend:", e);
      const { message } = extractErrorDetails(e);
      return fail(500, { error: message, action: "resendValidationEmail" });
    }

    if (!user?.username || !user?.email) {
      return fail(400, {
        error: "Could not determine username and email for this user.",
        action: "resendValidationEmail",
      });
    }

    try {
      const endpoint = `/obp/v7.0.0/users/validation-emails`;
      const result = await obp_requests.post(
        endpoint,
        { username: user.username, email: user.email },
        token,
      );

      logger.info(
        `Validation email request submitted for ${user.username} <${user.email}>`,
      );

      return {
        success: true,
        action: "resendValidationEmail",
        sentTo: user.email,
        username: user.username,
        apiMessage: result?.message,
      };
    } catch (e: any) {
      logger.error("Error requesting validation email:", e);
      const { message } = extractErrorDetails(e);
      return fail(500, { error: message, action: "resendValidationEmail" });
    }
  },
};
