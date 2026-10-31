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
import { createLogger } from '@obp/shared/utils';
import { takeReturnTo } from '@obp/shared/server/auth';
import { OAUTH_STATE_COOKIE, oauth2ProviderFactory } from '$lib/server/oauth';
import { obpRequests } from '$lib/server/obp';
import { loginErrorUrl } from '$lib/server/loginErrors';
import type { RequestHandler } from './$types';

const logger = createLogger('CohortLoginCallback');

/**
 * The redirect URI registered for every provider (APP_CALLBACK_URL). Exchanges the code for tokens,
 * reads the User from OBP and starts the session.
 */
export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	const storedState = cookies.get(OAUTH_STATE_COOKIE);
	cookies.delete(OAUTH_STATE_COOKIE, { path: '/' });

	const providerError = url.searchParams.get('error');
	if (providerError) {
		logger.warn(`Provider returned error "${providerError}"`);
		redirect(302, loginErrorUrl(providerError === 'access_denied' ? 'access_denied' : 'login_failed'));
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	if (!storedState) redirect(302, loginErrorUrl('session_expired'));
	if (!code || !state || state !== storedState) {
		logger.warn('Missing code or state mismatch on login callback');
		redirect(302, loginErrorUrl('invalid_state'));
	}

	const provider = storedState.split(':')[1];
	const client = provider ? oauth2ProviderFactory.getClient(provider) : undefined;
	const tokenEndpoint = client?.OIDCConfig?.token_endpoint;
	if (!client || !tokenEndpoint) redirect(302, loginErrorUrl('provider_unavailable'));

	let accessToken: string;
	let refreshToken: string | undefined;
	let idToken: string | undefined;
	try {
		const tokens = await client.validateAuthorizationCode(tokenEndpoint, code, null);
		try {
			idToken = tokens.idToken();
		} catch {
			idToken = undefined;
		}
		// Google access tokens are opaque and can't be validated by OBP; its id_token is the JWT OBP checks.
		accessToken = provider === 'google' && idToken ? idToken : tokens.accessToken();
		refreshToken = tokens.refreshToken();
	} catch (err) {
		logger.error('Authorization code exchange failed:', err);
		redirect(302, loginErrorUrl('login_failed'));
	}

	let user;
	try {
		user = await obpRequests.get('/obp/v5.1.0/users/current', accessToken);
	} catch (err) {
		logger.error('Fetching the current User from OBP failed:', err);
		redirect(302, loginErrorUrl('user_lookup_failed'));
	}
	if (!user?.user_id) redirect(302, loginErrorUrl('user_lookup_failed'));

	await locals.session.setData({
		user,
		oauth: { access_token: accessToken, refresh_token: refreshToken, id_token: idToken, provider }
	});
	await locals.session.save();
	logger.info(`Session started for ${user.username || user.email} (${user.user_id}) via ${provider}`);

	redirect(302, takeReturnTo(cookies) ?? '/dashboard');
};
