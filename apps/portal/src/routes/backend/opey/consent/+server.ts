import { env } from '$env/dynamic/private';
import { obp_requests } from '$lib/obp/requests';
import { obpErrorResponse } from '@obp/shared/obp';
import { createOpeyConsentHandler } from '@obp/shared/server/opey';
import { getOpeyConsentTtlSeconds } from '$lib/server/userPreferences';

/**
 * POST /backend/opey/consent — mints a per-tool-call consent at OBP for Opey.
 * Shared implementation (@obp/shared/server/opey); this app supplies its request helper,
 * consumer id and the per-user consent lifetime preference.
 */
export const { POST } = createOpeyConsentHandler({
	obpRequests: obp_requests,
	opeyConsumerId: () => env.OPEY_CONSUMER_ID,
	desiredTtlSeconds: (accessToken) => getOpeyConsentTtlSeconds(accessToken, Number(env.OPEY_CONSENT_TTL_SECONDS)),
	obpErrorResponse
});
