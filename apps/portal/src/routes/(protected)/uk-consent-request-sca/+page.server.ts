import { createLogger } from '@obp/shared/utils';
const logger = createLogger('UKConsentRequestSCA');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';
import { oauth2ProviderFactory } from '$lib/oauth/providerFactory';

/**
 * UK Open Banking consent SCA (OTP entry).
 *
 * Reached after /uk-consent-request started a challenge. The PSU enters the OTP; on a valid answer
 * OBP-API authorises the consent (status -> AUTHORISED, bound to this user) and we hand control back
 * to OBP-OIDC (with username + provider) so it mints a consent-bound auth code.
 */
export async function load(event: RequestEvent) {
	const consentId = event.url.searchParams.get('CONSENT_ID');
	const bankId = event.url.searchParams.get('bank_id');
	const challengeId = event.url.searchParams.get('challenge_id');
	const requestedOidcReturnUrl = event.url.searchParams.get('oidc_return_url');

	if (!consentId || !bankId || !challengeId) {
		return {
			loadError: 'Missing required parameter (CONSENT_ID, bank_id or challenge_id).',
			consentId: consentId || '',
			bankId: bankId || '',
			challengeId: challengeId || '',
			oidcReturnUrl: ''
		};
	}

	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		return { loadError: 'Unauthorized: No access token found in session.', consentId, bankId, challengeId, oidcReturnUrl: '' };
	}

	const oidcReturnUrl =
		requestedOidcReturnUrl && oauth2ProviderFactory.isTrustedOidcReturnUrl(requestedOidcReturnUrl)
			? requestedOidcReturnUrl
			: '';
	if (requestedOidcReturnUrl && !oidcReturnUrl) {
		logger.warn(`Rejected untrusted oidc_return_url: ${requestedOidcReturnUrl}`);
	}

	return { consentId, bankId, challengeId, oidcReturnUrl };
}

export const actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const otp = formData.get('otp') as string;
		const consentId = formData.get('consentId') as string;
		const bankId = formData.get('bankId') as string;
		const challengeId = formData.get('challengeId') as string;
		const oidcReturnUrlRaw = formData.get('oidcReturnUrl') as string;

		if (!otp) {
			return { message: 'Please enter the OTP code.' };
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { message: 'No access token found in session.' };
		}

		const oidcReturnUrl =
			oidcReturnUrlRaw && oauth2ProviderFactory.isTrustedOidcReturnUrl(oidcReturnUrlRaw)
				? oidcReturnUrlRaw
				: '';
		if (!oidcReturnUrl) {
			return { message: 'No valid return URL was provided to complete the flow.' };
		}

		try {
			// Verify the OTP and authorise the consent. OBP-API flips it to AUTHORISED and binds it to
			// the PSU only if the challenge answer is correct; a wrong answer leaves it unauthorised.
			await obp_requests.post(
				`/obp/v5.1.0/banks/${bankId}/consents/${consentId}/authorise`,
				{ challenge_id: challengeId, answer: otp },
				token
			);
		} catch (e) {
			logger.error('Error verifying UK consent SCA:', e);
			let errorMessage = 'Failed to verify OTP.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { message: errorMessage };
		}

		// Hand control back to OBP-OIDC so it mints a consent-bound auth code. username + provider let
		// OBP-OIDC's consent callback resolve the PSU (via GET /users/provider/{provider}/username/{username}).
		const returnUrl = new URL(oidcReturnUrl);
		returnUrl.searchParams.set('consent_id', consentId);
		returnUrl.searchParams.set('consent_status', 'ACCEPTED');
		const username = locals.session.data.user?.username;
		const provider = locals.session.data.user?.provider;
		if (username) returnUrl.searchParams.set('username', username);
		if (provider) returnUrl.searchParams.set('provider', provider);
		redirect(303, returnUrl.toString());
	}
} satisfies Actions;
