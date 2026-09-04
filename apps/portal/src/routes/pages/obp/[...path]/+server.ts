import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { createObpProxyHandler } from '@obp/shared/server/obp';

/**
 * OBP proxy for published Apps (/pages/SLUG, kind app). Like /proxy/obp/..., but visitors
 * without a session are let through with no Authorization header, so an App on a public
 * page can read OBP's public endpoints (banks, products) while a logged-in visitor's own
 * access still applies. The App itself never holds a token: it runs in a sandboxed iframe
 * and only talks to this route through the page's bridge.
 */
const proxyRequest = createObpProxyHandler(env.PUBLIC_OBP_BASE_URL, { allowAnonymous: true });

export const GET: RequestHandler = proxyRequest;
export const POST: RequestHandler = proxyRequest;
export const PUT: RequestHandler = proxyRequest;
export const DELETE: RequestHandler = proxyRequest;
export const PATCH: RequestHandler = proxyRequest;
