import type { PageServerLoad } from "./$types";
import { error } from "@sveltejs/kit";
import { createLogger } from "$lib/utils/logger";
import { obp_requests } from "$lib/obp/requests";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";

const logger = createLogger("EditGroupPageServer");

interface Group {
  group_id: string;
  bank_id: string;
  group_name: string;
  group_description: string;
  is_enabled: boolean;
  list_of_roles?: string[];
}

interface Role {
  role: string;
  requires_bank_id: boolean;
}

interface RolesResponse {
  roles: Role[];
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const session = locals.session;

  if (!session?.data?.user) {
    throw error(401, "Unauthorized");
  }

  const { group_id } = params;

  if (!group_id) {
    throw error(400, "Group ID is required");
  }

  const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
  const accessToken = sessionOAuth?.accessToken;

  if (!accessToken) {
    logger.warn("No access token available for edit group page");
    return {
      group: null,
      roles: [],
      hasApiAccess: false,
      error: "No API access token available",
    };
  }

  try {
    logger.info("=== FETCHING GROUP FOR EDIT ===");
    logger.info(`Group ID: ${group_id}`);
    const groupEndpoint = `/obp/v6.0.0/management/groups/${group_id}`;
    const rolesEndpoint = `/obp/v6.0.0/roles`;

    const [group, rolesResponse] = await Promise.all([
      obp_requests.get(groupEndpoint, accessToken) as Promise<Group>,
      obp_requests.get(rolesEndpoint, accessToken) as Promise<RolesResponse>,
    ]);

    logger.info(`Loaded group ${group.group_name} with ${rolesResponse.roles?.length || 0} available roles`);

    return {
      group,
      roles: rolesResponse.roles || [],
      hasApiAccess: true,
    };
  } catch (err) {
    logger.error("Error loading group for edit:", err);

    return {
      group: null,
      roles: [],
      hasApiAccess: false,
      error: err instanceof Error ? err.message : "Failed to load group",
    };
  }
};
