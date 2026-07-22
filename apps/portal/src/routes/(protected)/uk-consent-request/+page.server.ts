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
// UK consent GET endpoints are version-specific (v3.1 vs v4.0.1 aisp), but return the same
// {Data: {Status, Permissions, ExpirationDateTime, ...}} shape — see OBP-API
// Http4sUKOBv310AccountAccess#getAccountAccessConsentsConsentId / Http4sUKOBv401AccountInfo#getAccountAccessConsentsConsentId.
function ukConsentGetPath(apiStandard: string, consentId: string): string {
	return apiStandard === 'UKOpenBankingV401'
		? `/open-banking/v4.0.1/aisp/account-access-consents/${consentId}`
		: `/open-banking/v3.1/account-access-consents/${consentId}`;
}

export async function load(event: RequestEvent) {
	const consentId = event.url.searchParams.get('CONSENT_ID');
	const bankId = event.url.searchParams.get('bank_id');
	const apiStandard = event.url.searchParams.get('api_standard') || 'UKOpenBanking';
	const requestedOidcReturnUrl = event.url.searchParams.get('oidc_return_url');

	if (!consentId) {
		return {
			loadError: 'Missing required parameter: CONSENT_ID.',
			consentId: '',
			bankId: bankId || '',
			apiStandard,
			oidcReturnUrl: ''
		};
	}
	if (!bankId) {
		return {
			loadError: 'Missing required parameter: bank_id.',
			consentId,
			bankId: '',
			apiStandard,
			oidcReturnUrl: ''
		};
	}

	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		return {
			loadError: 'Unauthorized: No access token found in session.',
			consentId,
			bankId,
			apiStandard,
			oidcReturnUrl: ''
		};
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
	// be fetched via user/current/consents (which requires ownership). The UK GET-consent-by-id
	// endpoint has no ownership check — any authenticated caller may inspect a consent by its ID,
	// matching the UK Open Banking spec's PSU-facing consent-status check before authorisation.
	let status = '';
	let permissions: string[] = [];
	let expirationDateTime = '';
	try {
		const consent = await obp_requests.get(ukConsentGetPath(apiStandard, consentId), token);
		status = consent?.Data?.Status || '';
		permissions = consent?.Data?.Permissions || [];
		expirationDateTime = consent?.Data?.ExpirationDateTime || '';
	} catch (e) {
		// Non-fatal: fall back to the generic approval screen without permission detail.
		logger.warn('Could not fetch UK consent details:', e);
	}

	// The PSU must pick which of their own accounts this consent's permissions apply to --
	// OBP-API only binds/grants access for accounts the authorising user actually holds
	// (POST .../authorise requires account_ids, and rejects any account the PSU doesn't hold).
	let userAccounts: { accountId: string; label: string }[] = [];
	try {
		const accountsResponse = await obp_requests.get('/obp/v6.0.0/my/accounts', token);
		userAccounts = (accountsResponse.accounts || [])
			.filter((account: any) => account.bank_id === bankId)
			.map((account: any) => ({
				accountId: account.id,
				label: account.label || account.id
			}));
	} catch (e) {
		logger.warn('Could not fetch user accounts:', e);
	}

	return {
		consentId,
		bankId,
		apiStandard,
		oidcReturnUrl,
		status,
		permissions,
		expirationDateTime,
		userAccounts
	};
}

export const actions = {
	confirm: async ({ request, locals }) => {
		const formData = await request.formData();
		const consentId = formData.get('consentId') as string;
		const bankId = formData.get('bankId') as string;
		const oidcReturnUrlRaw = formData.get('oidcReturnUrl') as string;
		const selectedAccountIds = formData.getAll('selectedAccountIds') as string[];

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

		if (selectedAccountIds.length === 0) {
			return { message: 'Please select at least one account to grant access to.' };
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
			oidc_return_url: oidcReturnUrl,
			account_ids: selectedAccountIds.join(',')
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
