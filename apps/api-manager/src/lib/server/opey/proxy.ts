/**
 * This app's Opey proxy: every Opey call from the browser (chat stream, regenerate, stop,
 * invoke, status, diagram) goes through these handlers, whichever page embeds the chat.
 * They also record each turn into the app's conversation entity as the logged-in user.
 * Routes under /backend/opey re-export the handlers; see @obp/shared/server/opey.
 */
import { env } from '$env/dynamic/private';
import { createOpeyProxyHandlers } from '@obp/shared/server/opey';
import { MANAGER_OPEY_CONVERSATION_ENTITY_NAME } from '@obp/shared/opey';
import { obp_requests } from '$lib/obp/requests';

export const opeyProxy = createOpeyProxyHandlers({
	opeyBaseUrl: () => env.OPEY_BASE_URL,
	getAccessToken: (event) => event.locals.session?.data?.oauth?.access_token,
	recording: { entityName: MANAGER_OPEY_CONVERSATION_ENTITY_NAME, obpRequests: obp_requests }
});
