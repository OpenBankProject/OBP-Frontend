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
const logger = createLogger('OBPConsentRequestRedirect');
import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

export async function load(event: RequestEvent) {
	const consentId = event.url.searchParams.get('CONSENT_ID');
	const bankId = event.url.searchParams.get('bank_id');

	if (!consentId) {
		return {
			loadError: 'Missing required parameter: CONSENT_ID.',
			consentId: '',
			oidcReturnUrl: '',
		};
	}

	// Retrieve the OIDC return URL from session
	const flowData = event.locals.session.data.obpConsentFlow;
	const oidcReturnUrl = flowData?.oidcReturnUrl || '';

	if (oidcReturnUrl) {
		// Build the redirect URL back to OBP-OIDC
		const returnUrl = new URL(oidcReturnUrl);
		returnUrl.searchParams.set('consent_id', consentId);
		returnUrl.searchParams.set('consent_status', 'ACCEPTED');
		if (bankId) {
			returnUrl.searchParams.set('bank_id', bankId);
		}

		// Identify the authenticated user so OBP-OIDC can generate the auth code for them.
		// username + provider let OBP-OIDC resolve the user via the OBP-API REST endpoint
		// (GET /users/provider/PROVIDER/username/USERNAME); user_id is kept for reference.
		const sessionUser = event.locals.session.data.user;
		if (sessionUser?.user_id) {
			returnUrl.searchParams.set('user_id', sessionUser.user_id);
		}
		if (sessionUser?.username) {
			returnUrl.searchParams.set('username', sessionUser.username);
		}
		if (sessionUser?.provider) {
			returnUrl.searchParams.set('provider', sessionUser.provider);
		}

		// Clean up the consent flow data from session
		const sessionData = { ...event.locals.session.data };
		delete sessionData.obpConsentFlow;
		await event.locals.session.setData(sessionData);
		await event.locals.session.save();

		return {
			consentId,
			oidcReturnUrl: returnUrl.toString(),
		};
	}

	logger.warn('No OIDC return URL found in session for consent redirect');
	return {
		consentId,
		oidcReturnUrl: '',
	};
}
