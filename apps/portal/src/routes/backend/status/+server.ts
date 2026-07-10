import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { healthCheckRegistry, summarizeHealth } from '@obp/shared/health-check';

export const GET: RequestHandler = async () => {
	return json(summarizeHealth(healthCheckRegistry.getSnapshots()));
};
