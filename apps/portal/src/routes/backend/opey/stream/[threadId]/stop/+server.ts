import { opeyProxy } from '$lib/server/opey/proxy';

/** POST /backend/opey/stream/[threadId]/stop */
export const { POST } = opeyProxy.stop;
