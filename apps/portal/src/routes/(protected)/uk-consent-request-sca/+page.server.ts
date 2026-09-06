/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
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
		return {
			loadError: 'Unauthorized: No access token found in session.',
			consentId,
			bankId,
			challengeId,
			oidcReturnUrl: ''
		};
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

		// The selection the PSU made on the previous screen, held server-side against the challenge
		// that was minted for it. Read from the session rather than the request so what gets
		// authorised is what was on the screen they consented from -- see the note where it is
		// stored in uk-consent-request/+page.server.ts.
		const ukConsentFlow = locals.session.data.ukConsentFlow;
		const accountIds =
			ukConsentFlow?.consentId === consentId && ukConsentFlow?.challengeId === challengeId
				? ukConsentFlow.accountIds
				: [];
		if (accountIds.length === 0) {
			return { message: 'No accounts were selected for this consent. Please start over.' };
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
				{ challenge_id: challengeId, answer: otp, account_ids: accountIds },
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
		// oauth, not user: the session records the IdP that authenticated this PSU on the oauth
		// entry, and `user` has no `provider` at all. This read was always undefined, so the param
		// the comment above says OBP-OIDC needs to resolve the PSU was never actually sent.
		const provider = locals.session.data.oauth?.provider;
		if (username) returnUrl.searchParams.set('username', username);
		if (provider) returnUrl.searchParams.set('provider', provider);
		redirect(303, returnUrl.toString());
	}
} satisfies Actions;
