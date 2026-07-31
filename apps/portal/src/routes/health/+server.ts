import type { RequestHandler } from './$types';

/**
 * Liveness probe: this process is up and serving HTTP. It deliberately checks nothing else.
 *
 * It used to require every monitored dependency to be healthy and answer 503 otherwise, which is
 * readiness logic in a liveness endpoint. An orchestrator polling /health would then restart a
 * perfectly functional Portal because Opey or a secondary OAuth2 provider was down — Portal keeps
 * serving pages either way, so killing it only widens an unrelated outage.
 *
 * It also flattened the nuance /status already encodes: summarizeHealth treats the OAuth2 providers
 * as one group, so one dead provider alongside a working one is 'partial', not a failure. `every()`
 * turned any single unhealthy check — including a provider that was never configured — into a hard
 * 503. And it counted "no checks registered" as healthy, the opposite of the rule summarizeHealth
 * states for that case ('unknown', never 'healthy').
 *
 * Ask /status for dependency health: it reports per-service detail and its own overall verdict.
 * This matches the /health that OBP-API and Hola serve.
 */
export const GET: RequestHandler = async () => {
	return new Response(JSON.stringify({ status: 'ok' }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
};
