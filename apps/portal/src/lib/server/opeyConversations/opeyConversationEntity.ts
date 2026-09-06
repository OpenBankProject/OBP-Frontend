import { obp_requests } from "$lib/obp/requests";
import { createLogger } from "@obp/shared/utils";
import { getApplicationAccessToken } from "$lib/server/oauth/applicationToken";
import { ensureSystemDynamicEntity } from "@obp/shared/server/obp";
import { PORTAL_OPEY_CONVERSATION_ENTITY as OPEY_CONVERSATION } from "@obp/shared/opey";

const logger = createLogger("OpeyConversationEntity");

/** The personal dynamic entity this app writes Opey conversations into ("obp_portal_opey_conversation"). */
export const OPEY_CONVERSATION_ENTITY = OPEY_CONVERSATION.entity_name;

/**
 * Ensure the entity exists in OBP. Runs at startup with application access; needs the app's
 * consumer to support client_credentials and hold CanCreateSystemLevelDynamicEntity. Users
 * need no role: the entity is personal and personal_requires_role is false, so each User
 * writes and reads their own rows (they appear under My Data).
 */
export async function createOpeyConversationEntityIfNeeded(): Promise<boolean> {
  const accessToken = await getApplicationAccessToken();
  const ok = await ensureSystemDynamicEntity(OPEY_CONVERSATION, {
    accessToken,
    get: (path, token) => obp_requests.get(path, token),
    post: (path, body, token) => obp_requests.post(path, body, token),
    put: (path, body, token) => obp_requests.put(path, body, token),
  });
  if (!ok) logger.warn(`'${OPEY_CONVERSATION_ENTITY}' could not be ensured at startup; Opey conversations will not be recorded until it exists.`);
  return ok;
}
