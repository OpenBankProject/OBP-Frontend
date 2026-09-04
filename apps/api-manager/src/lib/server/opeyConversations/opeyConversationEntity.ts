import { obp_requests } from "$lib/obp/requests";
import { createLogger } from "@obp/shared/utils";
import { getApplicationAccessToken } from "$lib/server/oauth/applicationToken";
import { ensureSystemDynamicEntity } from "@obp/shared/server/obp";
import { MANAGER_OPEY_CONVERSATION_ENTITY, PORTAL_OPEY_CONVERSATION_ENTITY } from "@obp/shared/opey";

const logger = createLogger("OpeyConversationEntity");

/** The personal dynamic entity this app writes Opey conversations into ("obp_manager_opey_conversation"). */
export const OPEY_CONVERSATION_ENTITY = MANAGER_OPEY_CONVERSATION_ENTITY.entity_name;

/**
 * Ensure both apps' Opey conversation entities exist in OBP. Runs at startup with application
 * access: the API Manager's consumer holds CanCreateSystemLevelDynamicEntity, the Portal's
 * usually does not, so the API Manager creates the Portal's entity too (as it does for
 * obp_portal_page). Users need no role: the entities are personal and personal_requires_role
 * is false, so each User writes and reads their own rows (they appear under My Data).
 */
export async function createOpeyConversationEntitiesIfNeeded(): Promise<boolean> {
  const accessToken = await getApplicationAccessToken();
  const deps = {
    accessToken,
    get: (path: string, token: string) => obp_requests.get(path, token),
    post: (path: string, body: any, token: string) => obp_requests.post(path, body, token),
  };
  let allOk = true;
  for (const definition of [MANAGER_OPEY_CONVERSATION_ENTITY, PORTAL_OPEY_CONVERSATION_ENTITY]) {
    const ok = await ensureSystemDynamicEntity(definition, deps);
    if (!ok) {
      allOk = false;
      logger.warn(`'${definition.entity_name}' could not be ensured at startup; Opey conversations will not be recorded into it until it exists.`);
    }
  }
  return allOk;
}
