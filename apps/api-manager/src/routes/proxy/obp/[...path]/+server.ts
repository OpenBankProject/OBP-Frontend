import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { createObpProxyHandler } from '@obp/shared/server/obp';

// Generic authenticated OBP proxy (same as the Portal's /proxy/obp/...):
// adds the user's OAuth token and passes responses through unmodified.
// Implementation lives in @obp/shared (server/obp/obpProxy.ts).
const proxyRequest = createObpProxyHandler(env.PUBLIC_OBP_BASE_URL);

export const GET: RequestHandler = proxyRequest;
export const POST: RequestHandler = proxyRequest;
export const PUT: RequestHandler = proxyRequest;
export const DELETE: RequestHandler = proxyRequest;
export const PATCH: RequestHandler = proxyRequest;
