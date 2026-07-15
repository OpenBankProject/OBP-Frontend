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
 * The TPP has already lodged an account-access consent (status AWAITINGAUTHORISATION) and
 * routed the PSU here via OBP-OIDC. On approval we call OBP-API to authorise the consent as
 * the current PSU (status -> AUTHORISED, bound to this user), then hand control back to
 * OBP-OIDC so it mints an auth code whose token carries the consent_id claim.
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

		try {
			// Authorise the UK consent as the current PSU: OBP-API flips it to AUTHORISED and binds
			// it to this user. This is the missing "authorisation binding" step of the UK flow.
			await obp_requests.post(
				`/obp/v5.1.0/banks/${bankId}/consents/${consentId}/authorise`,
				{},
				token
			);
		} catch (e) {
			logger.error('Error authorising UK consent:', e);
			let errorMessage = 'Failed to authorise consent.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { message: errorMessage };
		}

		if (!oidcReturnUrl) {
			logger.warn('No trusted OIDC return URL for UK consent redirect');
			return { message: 'Consent authorised, but no valid return URL was provided to complete the flow.' };
		}

		// Hand control back to OBP-OIDC so it mints an auth code bound to this consent_id. We pass
		// username + provider so OBP-OIDC's consent callback can resolve the PSU (via
		// GET /users/provider/{provider}/username/{username}) and issue the code.
		const returnUrl = new URL(oidcReturnUrl);
		returnUrl.searchParams.set('consent_id', consentId);
		returnUrl.searchParams.set('consent_status', 'ACCEPTED');
		const username = locals.session.data.user?.username;
		const provider = locals.session.data.user?.provider;
		if (username) returnUrl.searchParams.set('username', username);
		if (provider) returnUrl.searchParams.set('provider', provider);
		redirect(303, returnUrl.toString());
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
