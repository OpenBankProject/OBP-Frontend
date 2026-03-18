import { createLogger } from '$lib/utils/logger';
const logger = createLogger('SubscriptionsServer');

import type { RequestEvent } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';

export async function load(event: RequestEvent) {
	const subscriptionsUrl = publicEnv.PUBLIC_SUBSCRIPTIONS_URL || '';

	if (!subscriptionsUrl) {
		logger.warn('PUBLIC_SUBSCRIPTIONS_URL is not set');
		return {
			subscriptionsUrl: '',
			status: 'not_configured' as const,
			statusMessage: 'The subscriptions service URL is not configured.'
		};
	}

	// Check if the subscriptions service is reachable
	try {
		const response = await fetch(subscriptionsUrl, {
			method: 'HEAD',
			signal: AbortSignal.timeout(10000)
		});

		if (response.ok) {
			logger.info(`Subscriptions service is available at ${subscriptionsUrl} (HTTP ${response.status})`);
			return {
				subscriptionsUrl,
				status: 'available' as const,
				statusMessage: 'The subscriptions service is available.'
			};
		} else {
			logger.warn(`Subscriptions service returned HTTP ${response.status} at ${subscriptionsUrl}`);
			return {
				subscriptionsUrl,
				status: 'error' as const,
				statusMessage: `The subscriptions service returned HTTP ${response.status}.`
			};
		}
	} catch (e) {
		const errorMsg = e instanceof Error ? e.message : String(e);
		logger.error(`Subscriptions service is not reachable at ${subscriptionsUrl}:`, e);
		return {
			subscriptionsUrl,
			status: 'unavailable' as const,
			statusMessage: `The subscriptions service is not reachable: ${errorMsg}`
		};
	}
}
