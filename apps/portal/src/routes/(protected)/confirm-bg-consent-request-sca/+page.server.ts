import { createLogger } from '@obp/shared/utils';
const logger = createLogger('ConfirmBGConsentRequestSCA');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { redirect, isRedirect } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';
import type {
	OBPBGStartConsentAuthorisation,
	OBPBGConsentAuthorisationResult
} from '$lib/obp/types';

export async function load(event: RequestEvent) {
	const consentId = event.url.searchParams.get('CONSENT_ID');

	if (!consentId) {
		return {
			loadError: 'Missing required parameter: CONSENT_ID.',
			consentId: '',
			authorisationId: ''
		};
	}

	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		return {
			loadError: 'No access token found in session.',
			consentId,
			authorisationId: ''
		};
	}

	try {
		const startResponse: OBPBGStartConsentAuthorisation = await obp_requests.post(
			`/berlin-group/v1.3/consents/${consentId}/authorisations`,
			{ scaAuthenticationData: '' },
			token
		);

		return { consentId, authorisationId: startResponse.authorisationId };
	} catch (e) {
		logger.error('Error starting BG consent authorisation:', e);
		let errorMessage = 'Failed to start consent authorisation.';
		if (e instanceof OBPRequestError) {
			errorMessage = e.message;
		}
		return { loadError: errorMessage, consentId, authorisationId: '' };
	}
}

export const actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const otp = formData.get('otp') as string;
		const consentId = formData.get('consentId') as string;
		const authorisationId = formData.get('authorisationId') as string;

		if (!otp) {
			return { message: 'Please enter the OTP code.' };
		}

		if (!authorisationId) {
			// There is no authorisation to answer because starting one failed, and the reason is
			// already on the page above. Telling the PSU to reload sends them round the same loop.
			return {
				message:
					'This consent has no authorisation to confirm — starting one did not succeed. See the reason above.'
			};
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { message: 'No access token found in session.' };
		}

		try {
			const response: OBPBGConsentAuthorisationResult = await obp_requests.put(
				`/berlin-group/v1.3/consents/${consentId}/authorisations/${authorisationId}`,
				{ scaAuthenticationData: otp },
				token
			);

			if (response.scaStatus === 'valid') {
				redirect(303, `/confirm-bg-consent-request-redirect-uri?CONSENT_ID=${consentId}`);
			}

			return {
				message: `Challenge was not accepted. Status: ${response.scaStatus}`
			};
		} catch (e) {
			if (isRedirect(e)) throw e;
			logger.error('Error submitting BG consent SCA:', e);
			let errorMessage = 'Failed to verify OTP.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { message: errorMessage };
		}
	}
} satisfies Actions;
