import type { PageServerLoad } from './$types';
import { healthCheckRegistry, summarizeHealth } from '@obp/shared/health-check';

export const load: PageServerLoad = async () => {
	return summarizeHealth(healthCheckRegistry.getSnapshots());
};
