import type { RequestHandler } from './$types';
import { healthCheckRegistry, summarizeHealth } from '@obp/shared/health-check';

/**
 * Readiness probe: this instance can do useful work, i.e. its dependencies answer.
 *
 * The other half of the split /health introduced. /health is liveness and says only "the process is
 * serving HTTP", which is what an orchestrator should restart on. Readiness is what a load balancer
 * should route on, and it needs a status code, not a rendered page: /status shows the same verdict
 * to a human but is a +page and answers 200 whatever it finds, so nothing machine-readable reported
 * dependency health at all.
 *
 * `partial` stays ready on purpose. summarizeHealth reports it when a group still has a working
 * member -- one OAuth2 provider down while another serves -- and pulling the instance out of
 * rotation for that would turn a degraded login into no login. `unknown` is not ready: it means no
 * check has reported yet, and claiming readiness on no evidence is how a starting instance takes
 * traffic it cannot serve.
 */
export const GET: RequestHandler = async () => {
	const summary = summarizeHealth(healthCheckRegistry.getSnapshots());
	const ready = summary.overallStatus === 'healthy' || summary.overallStatus === 'partial';

	return new Response(JSON.stringify({ status: summary.overallStatus, ready, services: summary.services }), {
		status: ready ? 200 : 503,
		headers: { 'Content-Type': 'application/json' }
	});
};
