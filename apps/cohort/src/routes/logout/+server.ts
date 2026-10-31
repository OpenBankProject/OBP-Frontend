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
import { sessionOAuth, SESSION_COOKIE } from '$lib/server/oauth';
import type { RequestHandler } from './$types';

const logger = createLogger('CohortLogout');

/**
 * Ends the session (POST only, so a link or image elsewhere cannot log the User out). Keycloak gets a
 * front-channel logout; other providers get the access token revoked where they offer revocation.
 */
export const POST: RequestHandler = async ({ locals, cookies, url }) => {
	const session = locals.session;
	const oauth = sessionOAuth.getSessionOAuth(session);
	const idToken = session.data.oauth?.id_token;
	const userId = session.data.user?.user_id;

	cookies.delete(SESSION_COOKIE, { path: '/' });
	await session.destroy();
	if (!oauth) redirect(303, '/');

	const endSession = oauth.client.OIDCConfig?.end_session_endpoint;
	if (oauth.provider === 'keycloak' && idToken && endSession) {
		const logoutUrl = new URL(endSession);
		logoutUrl.searchParams.set('id_token_hint', idToken);
		logoutUrl.searchParams.set('post_logout_redirect_uri', url.origin);
		redirect(303, logoutUrl.toString());
	}

	const revocation = oauth.client.OIDCConfig?.revocation_endpoint;
	if (revocation) {
		try {
			const response = await fetch(revocation, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Authorization: `Bearer ${oauth.accessToken}`
				},
				body: new URLSearchParams({ token: oauth.accessToken, token_type_hint: 'access_token' }),
				signal: AbortSignal.timeout(5_000)
			});
			if (!response.ok) logger.warn(`Token revocation for ${userId} answered ${response.status}`);
		} catch (err) {
			logger.warn(`Token revocation for ${userId} failed (logout continues):`, err);
		}
	}

	redirect(303, '/');
};
