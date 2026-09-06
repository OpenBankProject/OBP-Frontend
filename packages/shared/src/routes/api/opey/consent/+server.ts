import { env } from '$env/dynamic/private';
import { obpRequests } from '../../../../hooks.server';
import { createOpeyConsentHandler } from '$lib/server/opey/consentHandler';

/**
 * POST /api/opey/consent — the shared package's own route, same handler the apps mount at
 * /backend/opey/consent.
 */
export const { POST } = createOpeyConsentHandler({
	obpRequests,
	opeyConsumerId: () => env.OPEY_CONSUMER_ID
});
