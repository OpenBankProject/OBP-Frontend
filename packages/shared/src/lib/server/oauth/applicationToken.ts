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
import { createLogger } from '$shared/utils/logger';
import type { OAuth2ClientWithConfig } from './client.js';

const logger = createLogger('ApplicationToken');

interface CachedToken {
	accessToken: string;
	expiresAt: number;
}
const cache = new Map<string, CachedToken>();

/**
 * An application access token (client_credentials grant) for the app's own OAuth client,
 * so server code can call OBP without a logged-in user. Cached per client id until shortly
 * before expiry. Returns null when the client is not configured or the grant is refused.
 */
export async function getApplicationAccessToken(
	client: OAuth2ClientWithConfig | undefined,
	clientId: string | undefined,
	clientSecret: string | undefined,
	refreshMarginMs = 60_000
): Promise<string | null> {
	const tokenEndpoint = client?.OIDCConfig?.token_endpoint;
	if (!tokenEndpoint || !clientId || !clientSecret) {
		logger.warn('No OAuth client, token endpoint or client credentials available for application access.');
		return null;
	}
	const cached = cache.get(clientId);
	if (cached && cached.expiresAt - refreshMarginMs > Date.now()) return cached.accessToken;

	const body = new URLSearchParams();
	body.set('grant_type', 'client_credentials');
	body.set('client_id', clientId);
	body.set('client_secret', clientSecret);
	try {
		const response = await fetch(tokenEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
			body: body.toString()
		});
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			logger.warn(`Application access token request failed: ${response.status} ${response.statusText}`, errorData);
			return null;
		}
		const tokens = (await response.json()) as { access_token?: string; expires_in?: number };
		if (!tokens.access_token) return null;
		const ttlMs = (typeof tokens.expires_in === 'number' ? tokens.expires_in : 300) * 1000;
		cache.set(clientId, { accessToken: tokens.access_token, expiresAt: Date.now() + ttlMs });
		return tokens.access_token;
	} catch (err) {
		logger.warn(`Failed to obtain application access token: ${err}`);
		return null;
	}
}
