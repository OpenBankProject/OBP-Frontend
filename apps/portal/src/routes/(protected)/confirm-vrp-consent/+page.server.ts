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
const logger = createLogger('ConfirmVRPConsent');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';
import { env } from '$env/dynamic/private';

export async function load(event: RequestEvent) {
	const consentId = event.url.searchParams.get('CONSENT_ID');


	if (!consentId) {
		return {
			loadError: 'Missing required parameter: CONSENT_ID.',
			consentId: '',
			};
	}

	return { consentId };
}

export const actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const otp = formData.get('otp') as string;
		const consentId = formData.get('consentId') as string;

		if (!otp) {
			return { message: 'Please enter the OTP code.' };
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { message: 'No access token found in session.' };
		}

		const defaultBankId = env.DEFAULT_BANK_ID;
		if (!defaultBankId) {
			logger.error('DEFAULT_BANK_ID environment variable is not set');
			return { message: 'Server configuration error: DEFAULT_BANK_ID is not set.' };
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
					message: `Consent challenge was not accepted. Status: ${challengeResponse.status}`
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
			return { message: errorMessage };
		}
	}
} satisfies Actions;
