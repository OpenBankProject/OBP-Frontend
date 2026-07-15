import { createLogger } from '@obp/shared/utils';
const logger = createLogger('UKConsentRequest');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';
import { oauth2ProviderFactory } from '$lib/oauth/providerFactory';

/**
 * UK Open Banking consent approval.
 *
 * The TPP has already lodged an account-access consent (status AWAITINGAUTHORISATION) and routed
 * the PSU here via OBP-OIDC. On approval we start Strong Customer Authentication (OBP-API issues a
 * one-time challenge to the PSU) and route to /uk-consent-request-sca to collect the OTP; the
 * consent is only authorised (status -> AUTHORISED, bound to this user) once the correct OTP is
 * submitted, after which control returns to OBP-OIDC to mint a consent-bound auth code.
 */
export async function load(event: RequestEvent) {
	const consentId = event.url.searchParams.get('CONSENT_ID');
	const bankId = event.url.searchParams.get('bank_id');
	const requestedOidcReturnUrl = event.url.searchParams.get('oidc_return_url');

	if (!consentId) {
		return { loadError: 'Missing required parameter: CONSENT_ID.', consentId: '', bankId: bankId || '', oidcReturnUrl: '' };
	}
	if (!bankId) {
		return { loadError: 'Missing required parameter: bank_id.', consentId, bankId: '', oidcReturnUrl: '' };
	}

	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		return { loadError: 'Unauthorized: No access token found in session.', consentId, bankId, oidcReturnUrl: '' };
	}

	// oidc_return_url must point back to a configured OIDC provider host — otherwise it becomes
	// an open redirect that would also leak consent_id / user identity on completion.
	const oidcReturnUrl =
		requestedOidcReturnUrl && oauth2ProviderFactory.isTrustedOidcReturnUrl(requestedOidcReturnUrl)
			? requestedOidcReturnUrl
			: '';
	if (requestedOidcReturnUrl && !oidcReturnUrl) {
		logger.warn(`Rejected untrusted oidc_return_url: ${requestedOidcReturnUrl}`);
	}

	// The UK consent is still awaiting authorisation and not yet bound to this user, so it can't
	// be fetched via user/current/consents. We show a generic approval; the requested permissions
	// live inside the consent and are enforced by OBP-API on data access.
	return { consentId, bankId, oidcReturnUrl };
}

export const actions = {
	confirm: async ({ request, locals }) => {
		const formData = await request.formData();
		const consentId = formData.get('consentId') as string;
		const bankId = formData.get('bankId') as string;
		const oidcReturnUrlRaw = formData.get('oidcReturnUrl') as string;

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { message: 'No access token found in session.' };
		}

		// Re-validate the return URL server-side — hidden form fields are attacker-controllable.
		const oidcReturnUrl =
			oidcReturnUrlRaw && oauth2ProviderFactory.isTrustedOidcReturnUrl(oidcReturnUrlRaw)
				? oidcReturnUrlRaw
				: '';
		if (!oidcReturnUrl) {
			logger.warn('No trusted OIDC return URL for UK consent flow');
			return { message: 'No valid return URL was provided to complete the flow.' };
		}

		let challengeId = '';
		try {
			// Start SCA: OBP-API issues a one-time challenge (OTP) to the PSU. The consent is only
			// authorised on the /uk-consent-request-sca page once the correct OTP is submitted.
			const challengeResponse = await obp_requests.post(
				`/obp/v5.1.0/banks/${bankId}/consents/${consentId}/authorise/challenge`,
				{},
				token
			);
			challengeId = challengeResponse.challenge_id;
		} catch (e) {
			logger.error('Error starting UK consent SCA challenge:', e);
			let errorMessage = 'Failed to start Strong Customer Authentication.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { message: errorMessage };
		}

		const params = new URLSearchParams({
			CONSENT_ID: consentId,
			bank_id: bankId,
			challenge_id: challengeId,
			oidc_return_url: oidcReturnUrl
		});
		redirect(303, `/uk-consent-request-sca?${params.toString()}`);
	},

	deny: async ({ request }) => {
		const formData = await request.formData();
		const oidcReturnUrlRaw = formData.get('oidcReturnUrl') as string;
		const oidcReturnUrl =
			oidcReturnUrlRaw && oauth2ProviderFactory.isTrustedOidcReturnUrl(oidcReturnUrlRaw)
				? oidcReturnUrlRaw
				: '';
		if (oidcReturnUrl) {
			const returnUrl = new URL(oidcReturnUrl);
			returnUrl.searchParams.set('consent_status', 'REJECTED');
			redirect(303, returnUrl.toString());
		}
		redirect(303, '/');
	}
} satisfies Actions;
