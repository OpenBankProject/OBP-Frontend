import { env } from '$env/dynamic/private';
import { obp_requests } from '$lib/obp/requests';
import { obpErrorResponse } from '$lib/obp/errors';
import { createOpeyConsentHandler } from '@obp/shared/server/opey';

/**
 * POST /backend/opey/consent — mints a per-tool-call consent at OBP for Opey.
 * Shared implementation (@obp/shared/server/opey); this app supplies its request helper
 * and consumer id and keeps the default one-hour lifetime.
 */
export const { POST } = createOpeyConsentHandler({
	obpRequests: obp_requests,
	opeyConsumerId: () => env.OPEY_CONSUMER_ID,
	obpErrorResponse
});
