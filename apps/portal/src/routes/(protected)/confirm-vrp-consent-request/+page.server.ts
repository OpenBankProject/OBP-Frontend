import { createLogger } from '$lib/utils/logger';
const logger = createLogger('ConfirmVRPConsentRequest');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { redirect, isRedirect } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '$lib/obp/errors';

export async function load(event: RequestEvent) {
	const consentRequestId = event.url.searchParams.get('CONSENT_REQUEST_ID');
	const format = event.url.searchParams.get('format') || 'both';


	if (!consentRequestId) {
		return {
			loadError: 'Missing required parameter: CONSENT_REQUEST_ID.',
			consentRequestId: '',
			consentRequest: null,
			payload: {},
			format,
			};
	}

	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		return {
			loadError: 'Unauthorized: No access token found in session.',
			consentRequestId,
			consentRequest: null,
			payload: {},
			format,
			};
	}

	try {
		const consentRequest = await obp_requests.get(
			`/obp/v5.0.0/consumer/consent-requests/${consentRequestId}`,
			token
		);

		let payload: any = {};
		try {
			payload = JSON.parse(consentRequest.payload || '{}');
		} catch {
			logger.warn('Could not parse consent request payload');
		}

		return {
			consentRequestId,
			consentRequest,
			payload,
			format,
			};
	} catch (e) {
		logger.error('Error fetching consent request:', e);
		let errorMessage = 'Could not fetch consent request details.';
		if (e instanceof OBPRequestError) {
			errorMessage = e.message;
		}
		return {
			loadError: errorMessage,
			consentRequestId,
			consentRequest: null,
			payload: {},
			format,
			};
	}
}

export const actions = {
	confirm: async ({ request, locals }) => {
		const formData = await request.formData();
		const consentRequestId = formData.get('consentRequestId') as string;

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { error: 'No access token found in session.' };
		}

		try {
			const response = await obp_requests.post(
				`/obp/v5.0.0/consumer/consent-requests/${consentRequestId}/IMPLICIT/consents`,
				{},
				token
			);

			const consentId = response.consent_id;
			redirect(303, `/confirm-vrp-consent?CONSENT_ID=${consentId}`);
		} catch (e) {
			if (isRedirect(e)) throw e;
			logger.error('Error confirming VRP consent request:', e);
			let errorMessage = 'Failed to confirm consent request.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { error: errorMessage };
		}
	}
} satisfies Actions;
