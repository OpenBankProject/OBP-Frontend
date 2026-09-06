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
const logger = createLogger('ConfirmVRPConsentRequest');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { redirect, isRedirect } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';

export async function load(event: RequestEvent) {
	const consentRequestId = event.url.searchParams.get('CONSENT_REQUEST_ID');
	const format = event.url.searchParams.get('format') || 'both';


	if (!consentRequestId) {
		return {
			loadError: 'Missing required parameter: CONSENT_REQUEST_ID.',
			consentRequestId: '',
			consentRequest: null,
			payload: {},
			format,
			};
	}

	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		return {
			loadError: 'Unauthorized: No access token found in session.',
			consentRequestId,
			consentRequest: null,
			payload: {},
			format,
			};
	}

	try {
		const consentRequest = await obp_requests.get(
			`/obp/v5.0.0/consumer/consent-requests/${consentRequestId}`,
			token
		);

		let payload: any = {};
		try {
			payload = JSON.parse(consentRequest.payload || '{}');
		} catch {
			logger.warn('Could not parse consent request payload');
		}

		return {
			consentRequestId,
			consentRequest,
			payload,
			format,
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
			consentRequest: null,
			payload: {},
			format,
			};
	}
}

export const actions = {
	confirm: async ({ request, locals }) => {
		const formData = await request.formData();
		const consentRequestId = formData.get('consentRequestId') as string;

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
			redirect(303, `/confirm-vrp-consent?CONSENT_ID=${consentId}`);
		} catch (e) {
			if (isRedirect(e)) throw e;
			logger.error('Error confirming VRP consent request:', e);
			let errorMessage = 'Failed to confirm consent request.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { message: errorMessage };
		}
	}
} satisfies Actions;
