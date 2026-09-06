import { opeyProxy } from '$lib/server/opey/proxy';

/** POST /backend/opey/stream/[threadId]/regenerate?message_id= */
export const { POST } = opeyProxy.regenerate;
