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
import { createLogger } from '$lib/utils/logger';
const logger = createLogger('LogoutServer');
import { sessionOAuthHelper } from '../../hooks.server';
import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent): Promise<Response> {
	const session = event.locals.session;
	if (!session || !session.data.user) {
		logger.warn('No user session found, nothing to revoke.');
		return new Response(null, {
			status: 302,
			headers: {
				Location: `/`
			}
		});
	}

	const sessionOAuth = sessionOAuthHelper.getSessionOAuth(session);
	if (!sessionOAuth) {
		logger.warn('No OAuth session found, nothing to revoke.');
		return new Response(null, {
			status: 302,
			headers: {
				Location: `/`
			}
		});
	}

	// Get the access token before destroying session
	const accessToken = session.data.oauth?.access_token;
	const userId = session.data.user.user_id;

	// Clear the session cookie and destroy the session
	event.cookies.delete('obp-portal-connect.sid', {
		path: '/'
	});
	await session.destroy();

	// Try to revoke the access token if it exists and revocation endpoint is available
	const tokenRevokationUrl = sessionOAuth.client.OIDCConfig?.revocation_endpoint;
	if (accessToken && tokenRevokationUrl) {
		try {
			logger.info('Revoking access token for user:', userId);

			const response = await fetch(tokenRevokationUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Authorization: `Bearer ${accessToken}`
				},
				body: new URLSearchParams({
					token: accessToken,
					token_type_hint: 'access_token'
				})
			});

			if (response.ok) {
				logger.info('Successfully revoked access token for user:', userId);
			} else {
				const responseText = await response.text();
				logger.error(`Token revocation failed for user: ${userId}`, {
					status: response.status,
					statusText: response.statusText,
					endpoint: tokenRevokationUrl,
					responseBody: responseText
				});
			}
		} catch (error) {
			logger.error('Error during token revocation for user:', userId, error);
			// Continue with logout even if revocation fails
		}
	} else {
		if (!accessToken) {
			logger.warn('No access token found in session, skipping revocation.');
		}
		if (!tokenRevokationUrl) {
			logger.warn('No revocation endpoint configured, skipping token revocation.');
		}
	}

	// Redirect to the home page after logout
	return new Response(null, {
		status: 302,
		headers: {
			Location: `/`
		}
	});
}
