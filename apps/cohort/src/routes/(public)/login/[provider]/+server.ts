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
import { redirect } from '@sveltejs/kit';
import { generateState } from 'arctic';
import { createLogger } from '@obp/shared/utils';
import { LOGIN_SCOPES, OAUTH_STATE_COOKIE, oauth2ProviderFactory } from '$lib/server/oauth';
import { loginErrorUrl } from '$lib/server/loginErrors';
import type { RequestHandler } from './$types';

const logger = createLogger('CohortLogin');

/** Sends the browser to the provider's authorization endpoint. */
export const GET: RequestHandler = async ({ params, cookies }) => {
	const client = oauth2ProviderFactory.getClient(params.provider);
	const authEndpoint = client?.OIDCConfig?.authorization_endpoint;
	if (!client || !authEndpoint) {
		logger.warn(`Login requested for unavailable provider "${params.provider}"`);
		redirect(302, loginErrorUrl('provider_unavailable'));
	}

	// The provider travels in the state, so the single callback URL knows which client to use.
	const state = `${generateState()}:${params.provider}`;
	cookies.set(OAUTH_STATE_COOKIE, state, {
		httpOnly: true,
		maxAge: 60 * 10,
		secure: import.meta.env.PROD,
		path: '/',
		sameSite: 'lax'
	});

	redirect(302, client.createAuthorizationURL(authEndpoint, state, LOGIN_SCOPES).toString());
};
