/**
 * The personal dynamic entities the apps record Opey conversations into, one per app.
 * Both definitions live here so the API Manager, whose consumer holds
 * CanCreateSystemLevelDynamicEntity, can bootstrap both at startup (as it does for
 * obp_portal_page); each app records into its own. Rows are written as the logged-in
 * User and appear under My Data.
 */
import PORTAL from './data/portalOpeyConversationEntity.json';
import MANAGER from './data/managerOpeyConversationEntity.json';

export const PORTAL_OPEY_CONVERSATION_ENTITY = PORTAL;
export const MANAGER_OPEY_CONVERSATION_ENTITY = MANAGER;
export const PORTAL_OPEY_CONVERSATION_ENTITY_NAME: string = PORTAL.entity_name;
export const MANAGER_OPEY_CONVERSATION_ENTITY_NAME: string = MANAGER.entity_name;
