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
import { tppRedirectsOf } from '$lib/server/bgConsentRedirects';
const logger = createLogger('ConfirmBGConsentRequestRedirectURI');
import type { RequestEvent } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';

export async function load(event: RequestEvent) {
	const consentId = event.url.searchParams.get('CONSENT_ID');


	if (!consentId) {
		return {
			loadError: 'Missing required parameter: CONSENT_ID.',
			consentId: '',
			tppRedirectUri: '',
			status: '',
			};
	}

	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		return {
			loadError: 'Unauthorized: No access token found in session.',
			consentId,
			tppRedirectUri: '',
			status: '',
			};
	}

	try {
		const consent = await obp_requests.get(
			`/obp/v5.1.0/user/current/consents/${consentId}`,
			token
		);

		// Read from the consent on the server and checked against the redirect URL rules.
		const { tppRedirectUri, tppRedirectUriProblem } = tppRedirectsOf(consent);
		if (tppRedirectUriProblem) {
			logger.warn(`Not offering TPP-Redirect-URI of consent ${consentId}: ${tppRedirectUriProblem}`);
		}

		return {
			loadError: tppRedirectUriProblem
				? 'Your consent is confirmed, but the application gave a return address that is not allowed, so you cannot be sent back to it automatically.'
				: undefined,
			consentId,
			tppRedirectUri,
			status: consent.status,
			};
	} catch (e) {
		logger.error('Error fetching consent for redirect:', e);
		let errorMessage = 'Could not fetch consent details.';
		if (e instanceof OBPRequestError) {
			errorMessage = e.message;
		}
		return {
			loadError: errorMessage,
			consentId,
			tppRedirectUri: '',
			status: '',
			};
	}
}
