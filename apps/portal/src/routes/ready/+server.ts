import type { RequestHandler } from './$types';
import { healthCheckRegistry, summarizeHealth } from '@obp/shared/health-check';

/**
 * Services this app can serve its purpose without.
 *
 * Opey is the AI assistant. It is reached through its own route, and every other page renders and
 * every other call succeeds while it is down, so an instance whose only complaint is Opey is
 * degraded, not unready -- pulling it from rotation would take the whole Portal down to protect a
 * feature that was already unavailable.
 *
 * OBP API (gRPC) powers live streaming (chat) only; every page renders and every REST call works
 * while it is down, so it degrades the instance rather than unreadying it.
 *
 * Named exclusions rather than a list of required services on purpose: a service added later gates
 * readiness by default, and someone has to decide, in this file, that it is safe to ignore. The
 * other way round, a rename would silently drop a service from the required set and readiness would
 * quietly start passing on less than it used to.
 */
const NOT_REQUIRED_TO_SERVE = ['Opey (server)', 'OBP API (gRPC)'];

const OAUTH2_PREFIX = 'OAuth2: ';

/**
 * Readiness probe: this instance can do useful work, so route traffic to it.
 *
 * The other half of the split /health introduced. /health is liveness -- "the process is serving
 * HTTP" -- which is what an orchestrator should restart on. Readiness is what a load balancer should
 * route on, and it needs a status code rather than a rendered page: /status shows the same picture
 * to a human but is a +page and answers 200 whatever it finds.
 *
 * Deliberately not summarizeHealth's overall verdict. That treats every non-OAuth2 check as core, so
 * it reports `unhealthy` when Opey alone is down -- exactly the judgement /health was changed to
 * stop making. It stays right for the human view on /status, which shows the detail alongside it.
 *
 * The rule here: every required dependency healthy, and at least one OAuth2 provider healthy. One
 * dead provider beside a working one is degraded, not unready -- refusing traffic then turns a
 * degraded login into no login at all. A check that has not reported yet counts as not ready, since
 * claiming readiness on no evidence is how a starting instance takes traffic it cannot serve.
 */
export const GET: RequestHandler = async () => {
	const summary = summarizeHealth(healthCheckRegistry.getSnapshots());
	const entries = Object.entries(summary.services);

	const required = entries.filter(
		([name]) => !name.startsWith(OAUTH2_PREFIX) && !NOT_REQUIRED_TO_SERVE.includes(name)
	);
	const oauth2 = entries.filter(([name]) => name.startsWith(OAUTH2_PREFIX));

	const blocking = required.filter(([, s]) => s.status !== 'healthy').map(([name]) => name);
	const noProvider = oauth2.length > 0 && !oauth2.some(([, s]) => s.status === 'healthy');
	if (noProvider) blocking.push('no OAuth2 provider is available');

	// No checks at all is not evidence of readiness.
	const ready = entries.length > 0 && blocking.length === 0;

	// Service names only. This endpoint is unauthenticated -- a probe has to be reachable before the
	// app can prove anything about itself -- so it says whether to route traffic here and which
	// dependency is holding that up, and nothing else. summarizeHealth's snapshots carry each
	// service's configured URL and the text of its last error; returning those published the
	// deployment's internal hostnames, ports and failure modes to anyone who asked. /status shows
	// that detail to a signed-in human, which is where it belongs.
	return new Response(JSON.stringify({ ready, blocking }), {
		status: ready ? 200 : 503,
		headers: { 'Content-Type': 'application/json' }
	});
};
