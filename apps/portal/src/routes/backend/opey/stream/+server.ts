import { opeyProxy } from '$lib/server/opey/proxy';

/** POST /backend/opey/stream: relays the chat to Opey and records the turn. */
export const { POST } = opeyProxy.stream;
