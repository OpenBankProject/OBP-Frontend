import { createLogger } from '$lib/utils/logger';
const logger = createLogger('ConfirmVRPConsent');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '$lib/obp/errors';
import { env } from '$env/dynamic/private';

export async function load(event: RequestEvent) {
	const consentId = event.url.searchParams.get('CONSENT_ID');


	if (!consentId) {
		return {
			loadError: 'Missing required parameter: CONSENT_ID.',
			consentId: '',
			};
	}

	return { consentId, userEntitlements };
}

export const actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const otp = formData.get('otp') as string;
		const consentId = formData.get('consentId') as string;

		if (!otp) {
			return { error: 'Please enter the OTP code.' };
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { error: 'No access token found in session.' };
		}

		const defaultBankId = env.DEFAULT_BANK_ID;
		if (!defaultBankId) {
			logger.error('DEFAULT_BANK_ID environment variable is not set');
			return { error: 'Server configuration error: DEFAULT_BANK_ID is not set.' };
		}

		try {
			// Step 1: Submit OTP challenge
			const challengeResponse = await obp_requests.post(
				`/obp/v3.1.0/banks/${defaultBankId}/consents/${consentId}/challenge`,
				{ answer: otp },
				token
			);

			if (challengeResponse.status !== 'ACCEPTED') {
				return {
					error: `Consent challenge was not accepted. Status: ${challengeResponse.status}`
				};
			}

			// Step 2: Get consent details to find consumer_id
			const consentDetails = await obp_requests.get(
				`/obp/v5.1.0/user/current/consents/${consentId}`,
				token
			);

			const consumerId = consentDetails.consumer_id;

			// Step 3: Get consumer redirect URL
			const consumer = await obp_requests.get(
				`/obp/v5.1.0/management/consumers/${consumerId}`,
				token
			);

			const redirectUrl = consumer.redirect_url;
			const consentRequestId = consentDetails.consent_request_id || '';
			const status = challengeResponse.status;

			if (redirectUrl) {
				const separator = redirectUrl.includes('?') ? '&' : '?';
				const fullRedirectUrl = `${redirectUrl}${separator}CONSENT_REQUEST_ID=${consentRequestId}&status=${status}`;
				return {
					success: true,
					redirectUrl: fullRedirectUrl
				};
			}

			return {
				success: true,
				message: `Consent confirmed successfully. Status: ${status}`
			};
		} catch (e) {
			logger.error('Error confirming VRP consent:', e);
			let errorMessage = 'Failed to confirm consent.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { error: errorMessage };
		}
	}
} satisfies Actions;
