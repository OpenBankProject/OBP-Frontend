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
const logger = createLogger('OBPConsentRequest');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { redirect, isRedirect } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';
import { oauth2ProviderFactory } from '$lib/oauth/providerFactory';

export async function load(event: RequestEvent) {
	const consentRequestId = event.url.searchParams.get('CONSENT_REQUEST_ID');
	const bankId = event.url.searchParams.get('bank_id');

	if (!consentRequestId) {
		return {
			loadError: 'Missing required parameter: CONSENT_REQUEST_ID.',
			consentRequestId: '',
			bankId: bankId || '',
			consentRequest: null,
			payload: {},
			consumerName: '',
		};
	}

	if (!bankId) {
		return {
			loadError: 'Missing required parameter: bank_id.',
			consentRequestId,
			bankId: '',
			consentRequest: null,
			payload: {},
			consumerName: '',
		};
	}

	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		return {
			loadError: 'Unauthorized: No access token found in session.',
			consentRequestId,
			bankId,
			consentRequest: null,
			payload: {},
			consumerName: '',
		};
	}

	try {
		const consentRequest = await obp_requests.get(
			`/obp/v5.0.0/consumer/consent-requests/${consentRequestId}`,
			token
		);

		logger.info(`Consent request response: ${JSON.stringify(consentRequest)}`);

		// OBP-API returns `payload` as an already-parsed JSON object (JValue on the
		// server side), not a JSON string — do not JSON.parse it again.
		let payload: any = {};
		if (consentRequest.payload && typeof consentRequest.payload === 'object') {
			payload = consentRequest.payload;
		} else if (typeof consentRequest.payload === 'string' && consentRequest.payload) {
			try {
				payload = JSON.parse(consentRequest.payload);
			} catch {
				logger.warn('Could not parse consent request payload');
			}
		}
		logger.info(`Parsed payload: ${JSON.stringify(payload)}`);

		// Try to fetch the consumer/app name
		let consumerName = '';
		if (consentRequest.consumer_id) {
			try {
				const consumer = await obp_requests.get(
					`/obp/v5.1.0/management/consumers/${consentRequest.consumer_id}`,
					token
				);
				consumerName = consumer.app_name || '';
			} catch {
				logger.warn('Could not fetch consumer details');
			}
		}

		// Store the OIDC return URL in session if present — must point back to a
		// configured OIDC provider host, otherwise it's an open redirect / data leak.
		const requestedOidcReturnUrl = event.url.searchParams.get('oidc_return_url');
		const oidcReturnUrl =
			requestedOidcReturnUrl && oauth2ProviderFactory.isTrustedOidcReturnUrl(requestedOidcReturnUrl)
				? requestedOidcReturnUrl
				: null;
		if (requestedOidcReturnUrl && !oidcReturnUrl) {
			logger.warn(`Rejected untrusted oidc_return_url: ${requestedOidcReturnUrl}`);
		}
		if (oidcReturnUrl) {
			await event.locals.session.setData({
				...event.locals.session.data,
				obpConsentFlow: {
					oidcReturnUrl,
					consentRequestId,
					bankId,
				}
			});
			await event.locals.session.save();
		}

		return {
			consentRequestId,
			bankId,
			consentRequest,
			payload,
			consumerName,
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
			bankId,
			consentRequest: null,
			payload: {},
			consumerName: '',
		};
	}
}

export const actions = {
	confirm: async ({ request, locals }) => {
		const formData = await request.formData();
		const consentRequestId = formData.get('consentRequestId') as string;
		const bankId = formData.get('bankId') as string;

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { message: 'No access token found in session.' };
		}

		try {
			const response = await obp_requests.post(
				`/obp/v5.0.0/consumer/consent-requests/${consentRequestId}/IMPLICIT/consents`,
				{},
				token
			);

			const consentId = response.consent_id;
			redirect(303, `/obp-consent-request-sca?CONSENT_ID=${consentId}&bank_id=${bankId}`);
		} catch (e) {
			if (isRedirect(e)) throw e;
			logger.error('Error confirming consent request:', e);
			let errorMessage = 'Failed to confirm consent request.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { message: errorMessage };
		}
	},

	deny: async ({ locals }) => {
		const flowData = locals.session.data.obpConsentFlow;
		if (flowData?.oidcReturnUrl) {
			const returnUrl = new URL(flowData.oidcReturnUrl);
			returnUrl.searchParams.set('consent_status', 'REJECTED');
			redirect(303, returnUrl.toString());
		}
		redirect(303, '/');
	}
} satisfies Actions;
