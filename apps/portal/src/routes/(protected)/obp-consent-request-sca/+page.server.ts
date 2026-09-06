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
const logger = createLogger('OBPConsentRequestSCA');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { redirect, isRedirect } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';

export async function load(event: RequestEvent) {
	const consentId = event.url.searchParams.get('CONSENT_ID');
	const bankId = event.url.searchParams.get('bank_id');

	if (!consentId) {
		return {
			loadError: 'Missing required parameter: CONSENT_ID.',
			consentId: '',
			bankId: bankId || '',
		};
	}

	if (!bankId) {
		return {
			loadError: 'Missing required parameter: bank_id.',
			consentId,
			bankId: '',
		};
	}

	return { consentId, bankId };
}

export const actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const otp = formData.get('otp') as string;
		const consentId = formData.get('consentId') as string;
		const bankId = formData.get('bankId') as string;

		if (!otp) {
			return { message: 'Please enter the OTP code.' };
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { message: 'No access token found in session.' };
		}

		if (!bankId) {
			return { message: 'Missing bank_id parameter.' };
		}

		try {
			const response = await obp_requests.post(
				`/obp/v3.1.0/banks/${bankId}/consents/${consentId}/challenge`,
				{ answer: otp },
				token
			);

			if (response.status === 'ACCEPTED' || response.status === 'VALID') {
				redirect(303, `/obp-consent-request-redirect?CONSENT_ID=${consentId}&bank_id=${bankId}`);
			}

			return {
				message: `Challenge was not accepted. Status: ${response.status}`
			};
		} catch (e) {
			if (isRedirect(e)) throw e;
			logger.error('Error submitting consent SCA:', e);
			let errorMessage = 'Failed to verify OTP.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { message: errorMessage };
		}
	}
} satisfies Actions;
