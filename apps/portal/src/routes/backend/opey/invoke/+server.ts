import { opeyProxy } from '$lib/server/opey/proxy';

/** POST /backend/opey/invoke: one-shot, no thread, not recorded (used by the Insight Bar). */
export const { POST } = opeyProxy.invoke;
