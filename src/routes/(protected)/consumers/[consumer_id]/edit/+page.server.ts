import { createLogger } from "$lib/utils/logger";
import { obp_requests } from "$lib/obp/requests";
import { extractErrorDetails } from "$lib/obp/errors";
import { error, fail, redirect } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";

const logger = createLogger("EditConsumerServer");

interface CallCounter {
  calls_made: number;
  reset_in_seconds: number;
  status?: string;
}

interface Consumer {
  consumer_id: string;
  key?: string;
  secret?: string;
  app_name: string;
  app_type: string;
  description: string;
  developer_email: string;
  redirect_url: string;
  company: string;
  enabled: boolean;
  created: string;
  logo_url?: string;
  certificate_pem?: string;
  call_counters?: {
    per_second?: CallCounter;
    per_minute?: CallCounter;
    per_hour?: CallCounter;
    per_day?: CallCounter;
    per_week?: CallCounter;
    per_month?: CallCounter;
  };
  created_by_user?: {
    user_id: string;
    email: string;
    provider_id: string;
    provider: string;
    username: string;
  };
}

interface Scope {
  scope_id: string;
  role_name: string;
  bank_id: string;
}

interface ActiveRateLimits {
  considered_rate_limit_ids: string[];
  active_at_date: string;
  active_per_second_rate_limit: number;
  active_per_minute_rate_limit: number;
  active_per_hour_rate_limit: number;
  active_per_day_rate_limit: number;
  active_per_week_rate_limit: number;
  active_per_month_rate_limit: number;
}

interface Role {
  role: string;
  requires_bank_id: boolean;
}

export async function load(event: RequestEvent) {
  const session = event.locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const token = sessionOAuth?.accessToken;

  if (!token) {
    throw error(401, "Unauthorized: No access token found in session.");
  }

  const consumerId = event.params.consumer_id;

  if (!consumerId) {
    throw error(400, "Consumer ID is required.");
  }

  // Action-specific roles (checked when user attempts the action)
  const actionRoles = {
    enableDisable: { role: "CanEnableConsumers", action: "enable or disable consumers" },
    addScope: { role: "CanCreateScopeAtOneBank", action: "add scopes to consumers" },
    deleteScope: { role: "CanDeleteScopeAtAnyBank", action: "delete scopes from consumers" },
    updateRedirectUrl: { role: "CanUpdateConsumerRedirectUrl", action: "update consumer redirect URL" },
  };

  let consumer: Consumer | undefined = undefined;
  let scopes: Scope[] = [];
  let availableRoles: Role[] = [];
  let banks: Array<{ bank_id: string; short_name: string }> = [];
  let isCurrentConsumer = false;
  let rateLimitingInfo: {
    enabled?: boolean;
    is_active?: boolean;
    technology?: string;
    service_available?: boolean;
  } | null = null;
  let activeRateLimits: ActiveRateLimits | undefined = undefined;

  // Fetch consumer details
  try {
    consumer = await obp_requests.get(
      `/obp/v6.0.0/management/consumers/${consumerId}`,
      token,
    );
    logger.debug(`Retrieved consumer: ${consumer?.app_name}`);
  } catch (e) {
    logger.error("Error fetching consumer:", e);
    throw error(404, "Consumer not found.");
  }

  if (!consumer) {
    throw error(404, "Consumer not found.");
  }

  // Check if this is the current consumer (the one being used for this session)
  try {
    const currentConsumer = await obp_requests.get(
      `/obp/v6.0.0/consumers/current`,
      token,
    );
    isCurrentConsumer = currentConsumer?.consumer_id === consumerId;
    logger.debug(`Is current consumer: ${isCurrentConsumer}`);
  } catch (e) {
    logger.error("Error fetching current consumer:", e);
    // Non-fatal - continue without this info
  }

  // Fetch rate limiting info
  try {
    rateLimitingInfo = await obp_requests.get(
      `/obp/v6.0.0/rate-limiting`,
      token,
    );
    logger.debug(`Rate limiting info: enabled=${rateLimitingInfo?.enabled}, active=${rateLimitingInfo?.is_active}`);
  } catch (e) {
    logger.error("Error fetching rate limiting info:", e);
    // Non-fatal - continue without this info
  }

  // Fetch active rate limits for this consumer
  try {
    activeRateLimits = await obp_requests.get(
      `/obp/v6.0.0/management/consumers/${consumerId}/active-rate-limits`,
      token,
    );
    logger.debug(`Active rate limits: ${JSON.stringify(activeRateLimits)}`);
  } catch (e) {
    logger.error("Error fetching active rate limits:", e);
    // Non-fatal - continue without active limits
  }

  // Fetch scopes for this consumer
  try {
    const scopesResponse = await obp_requests.get(
      `/obp/v6.0.0/consumers/${consumerId}/scopes`,
      token,
    );
    scopes = scopesResponse?.list || [];
    logger.debug(`Retrieved ${scopes.length} scopes for consumer`);
  } catch (e) {
    logger.error("Error fetching scopes:", e);
    // Non-fatal - continue without scopes
  }

  // Fetch available roles
  try {
    const rolesResponse = await obp_requests.get(
      `/obp/v6.0.0/roles`,
      token,
    );
    availableRoles = rolesResponse?.roles || [];
    logger.debug(`Retrieved ${availableRoles.length} available roles`);
  } catch (e) {
    logger.error("Error fetching roles:", e);
    // Non-fatal - continue without roles
  }

  // Fetch banks for bank_id dropdown
  try {
    const banksResponse = await obp_requests.get(
      `/obp/v6.0.0/banks`,
      token,
    );
    banks = (banksResponse?.banks || []).map((b: any) => ({
      bank_id: b.bank_id,
      short_name: b.short_name || b.bank_id,
    }));
    logger.debug(`Retrieved ${banks.length} banks`);
  } catch (e) {
    logger.error("Error fetching banks:", e);
    // Non-fatal - continue without banks
  }

  return {
    consumer,
    scopes,
    availableRoles,
    banks,
    actionRoles,
    isCurrentConsumer,
    rateLimitingInfo,
    activeRateLimits,
  };
}

export const actions = {
  // Action to enable/disable consumer
  toggleEnabled: async (event: RequestEvent) => {
    const session = event.locals.session;

    if (!session?.data?.user) {
      return fail(401, { error: "Unauthorized" });
    }

    const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
    const token = sessionOAuth?.accessToken;

    if (!token) {
      return fail(401, { error: "Unauthorized: No access token found in session." });
    }

    const consumerId = event.params.consumer_id;

    if (!consumerId) {
      return fail(400, { error: "Consumer ID is required." });
    }

    const formData = await event.request.formData();
    const enabled = formData.get("enabled") === "true";

    try {
      logger.info(`Setting consumer ${consumerId} enabled=${enabled}`);

      await obp_requests.put(
        `/obp/v6.0.0/management/consumers/${consumerId}`,
        { enabled },
        token,
      );

      logger.info(`Successfully updated consumer ${consumerId} enabled status`);

      return { success: true, action: "toggleEnabled" };
    } catch (e: any) {
      logger.error("Error updating consumer:", e);
      const { message } = extractErrorDetails(e);
      return fail(500, { error: message, action: "toggleEnabled" });
    }
  },

  // Action to add a scope
  addScope: async (event: RequestEvent) => {
    const session = event.locals.session;

    if (!session?.data?.user) {
      return fail(401, { error: "Unauthorized" });
    }

    const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
    const token = sessionOAuth?.accessToken;

    if (!token) {
      return fail(401, { error: "Unauthorized: No access token found in session." });
    }

    const consumerId = event.params.consumer_id;

    if (!consumerId) {
      return fail(400, { error: "Consumer ID is required." });
    }

    const formData = await event.request.formData();
    const role_name = formData.get("role_name") as string;
    const bank_id = formData.get("bank_id") as string || "";

    if (!role_name) {
      return fail(400, { error: "Role name is required.", action: "addScope" });
    }

    try {
      logger.info(`Adding scope ${role_name} to consumer ${consumerId}`);

      await obp_requests.post(
        `/obp/v6.0.0/consumers/${consumerId}/scopes`,
        { role_name, bank_id },
        token,
      );

      logger.info(`Successfully added scope to consumer ${consumerId}`);

      return { success: true, action: "addScope" };
    } catch (e: any) {
      logger.error("Error adding scope:", e);
      const { message } = extractErrorDetails(e);
      return fail(500, { error: message, action: "addScope" });
    }
  },

  // Action to delete a scope
  deleteScope: async (event: RequestEvent) => {
    const session = event.locals.session;

    if (!session?.data?.user) {
      return fail(401, { error: "Unauthorized" });
    }

    const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
    const token = sessionOAuth?.accessToken;

    if (!token) {
      return fail(401, { error: "Unauthorized: No access token found in session." });
    }

    const consumerId = event.params.consumer_id;

    if (!consumerId) {
      return fail(400, { error: "Consumer ID is required." });
    }

    const formData = await event.request.formData();
    const scope_id = formData.get("scope_id") as string;

    if (!scope_id) {
      return fail(400, { error: "Scope ID is required.", action: "deleteScope" });
    }

    try {
      logger.info(`Deleting scope ${scope_id} from consumer ${consumerId}`);

      await obp_requests.delete(
        `/obp/v6.0.0/consumers/${consumerId}/scope/${scope_id}`,
        token,
      );

      logger.info(`Successfully deleted scope from consumer ${consumerId}`);

      return { success: true, action: "deleteScope" };
    } catch (e: any) {
      logger.error("Error deleting scope:", e);
      const { message } = extractErrorDetails(e);
      return fail(500, { error: message, action: "deleteScope" });
    }
  },

  // Action to update consumer name
  updateName: async (event: RequestEvent) => {
    const session = event.locals.session;

    if (!session?.data?.user) {
      return fail(401, { error: "Unauthorized" });
    }

    const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
    const token = sessionOAuth?.accessToken;

    if (!token) {
      return fail(401, { error: "Unauthorized: No access token found in session." });
    }

    const consumerId = event.params.consumer_id;

    if (!consumerId) {
      return fail(400, { error: "Consumer ID is required." });
    }

    const formData = await event.request.formData();
    const app_name = formData.get("app_name") as string;

    if (!app_name?.trim()) {
      return fail(400, { error: "App name is required.", action: "updateName" });
    }

    try {
      logger.info(`Updating consumer ${consumerId} name to: ${app_name}`);

      await obp_requests.put(
        `/obp/v6.0.0/management/consumers/${consumerId}/consumer/name`,
        { app_name },
        token,
      );

      logger.info(`Successfully updated consumer ${consumerId} name`);

      return { success: true, action: "updateName" };
    } catch (e: any) {
      logger.error("Error updating consumer name:", e);
      const { message } = extractErrorDetails(e);
      return fail(500, { error: message, action: "updateName" });
    }
  },

  // Action to update consumer redirect URL
  updateRedirectUrl: async (event: RequestEvent) => {
    const session = event.locals.session;

    if (!session?.data?.user) {
      return fail(401, { error: "Unauthorized" });
    }

    const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
    const token = sessionOAuth?.accessToken;

    if (!token) {
      return fail(401, { error: "Unauthorized: No access token found in session." });
    }

    const consumerId = event.params.consumer_id;

    if (!consumerId) {
      return fail(400, { error: "Consumer ID is required." });
    }

    const formData = await event.request.formData();
    const redirect_url = formData.get("redirect_url") as string;

    if (!redirect_url?.trim()) {
      return fail(400, { error: "Redirect URL is required.", action: "updateRedirectUrl" });
    }

    try {
      logger.info(`Updating consumer ${consumerId} redirect URL`);

      await obp_requests.put(
        `/obp/v6.0.0/management/consumers/${consumerId}/consumer/redirect_url`,
        { redirect_url },
        token,
      );

      logger.info(`Successfully updated consumer ${consumerId} redirect URL`);

      return { success: true, action: "updateRedirectUrl" };
    } catch (e: any) {
      logger.error("Error updating consumer redirect URL:", e);
      const { message } = extractErrorDetails(e);
      return fail(500, { error: message, action: "updateRedirectUrl" });
    }
  },

  // Action to update consumer logo URL
  updateLogoUrl: async (event: RequestEvent) => {
    const session = event.locals.session;

    if (!session?.data?.user) {
      return fail(401, { error: "Unauthorized" });
    }

    const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
    const token = sessionOAuth?.accessToken;

    if (!token) {
      return fail(401, { error: "Unauthorized: No access token found in session." });
    }

    const consumerId = event.params.consumer_id;

    if (!consumerId) {
      return fail(400, { error: "Consumer ID is required." });
    }

    const formData = await event.request.formData();
    const logo_url = formData.get("logo_url") as string || "";

    try {
      logger.info(`Updating consumer ${consumerId} logo URL`);

      await obp_requests.put(
        `/obp/v6.0.0/management/consumers/${consumerId}/consumer/logo_url`,
        { logo_url },
        token,
      );

      logger.info(`Successfully updated consumer ${consumerId} logo URL`);

      return { success: true, action: "updateLogoUrl" };
    } catch (e: any) {
      logger.error("Error updating consumer logo URL:", e);
      const { message } = extractErrorDetails(e);
      return fail(500, { error: message, action: "updateLogoUrl" });
    }
  },

  // Action to update consumer certificate
  updateCertificate: async (event: RequestEvent) => {
    const session = event.locals.session;

    if (!session?.data?.user) {
      return fail(401, { error: "Unauthorized" });
    }

    const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
    const token = sessionOAuth?.accessToken;

    if (!token) {
      return fail(401, { error: "Unauthorized: No access token found in session." });
    }

    const consumerId = event.params.consumer_id;

    if (!consumerId) {
      return fail(400, { error: "Consumer ID is required." });
    }

    const formData = await event.request.formData();
    const certificate_pem = formData.get("certificate_pem") as string || "";

    try {
      logger.info(`Updating consumer ${consumerId} certificate`);

      await obp_requests.put(
        `/obp/v6.0.0/management/consumers/${consumerId}/consumer/certificate`,
        { certificate_pem },
        token,
      );

      logger.info(`Successfully updated consumer ${consumerId} certificate`);

      return { success: true, action: "updateCertificate" };
    } catch (e: any) {
      logger.error("Error updating consumer certificate:", e);
      const { message } = extractErrorDetails(e);
      return fail(500, { error: message, action: "updateCertificate" });
    }
  },
};
