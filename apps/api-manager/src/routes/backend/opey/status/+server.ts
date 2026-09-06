import { opeyProxy } from '$lib/server/opey/proxy';

/** GET /backend/opey/status: Opey's own status, for the chat's connection pip. */
export const { GET } = opeyProxy.status;
