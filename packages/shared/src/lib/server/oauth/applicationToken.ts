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

export type ApplicationTokenResult = { token: string } | { token: null; reason: string };

/**
 * An application access token (client_credentials grant) for the app's own OAuth client,
 * so server code can call OBP without a logged-in user. Cached per client id until shortly
 * before expiry. On failure, `reason` says which step failed, for messages shown to operators.
 */
export async function requestApplicationAccessToken(
	client: OAuth2ClientWithConfig | undefined,
	clientId: string | undefined,
	clientSecret: string | undefined,
	refreshMarginMs = 60_000
): Promise<ApplicationTokenResult> {
	const fail = (reason: string): ApplicationTokenResult => {
		logger.warn(`No application access token: ${reason}`);
		return { token: null, reason };
	};
	if (!client) {
		return fail('no OAuth2 provider is available (OIDC discovery failed or no provider is configured; see /status)');
	}
	const tokenEndpoint = client.OIDCConfig?.token_endpoint;
	if (!tokenEndpoint) {
		return fail("the OAuth2 provider's OIDC configuration has no token_endpoint");
	}
	const missing = [!clientId && 'OBP_OAUTH_CLIENT_ID', !clientSecret && 'OBP_OAUTH_CLIENT_SECRET'].filter(Boolean);
	if (missing.length > 0) {
		return fail(`${missing.join(' and ')} not set`);
	}
	const cached = cache.get(clientId!);
	if (cached && cached.expiresAt - refreshMarginMs > Date.now()) return { token: cached.accessToken };

	const body = new URLSearchParams();
	body.set('grant_type', 'client_credentials');
	body.set('client_id', clientId!);
	body.set('client_secret', clientSecret!);
	try {
		const response = await fetch(tokenEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
			body: body.toString()
		});
		if (!response.ok) {
			const errorData = (await response.json().catch(() => ({}))) as { error?: string; error_description?: string };
			const detail = [errorData.error, errorData.error_description].filter(Boolean).join(': ');
			return fail(
				`${tokenEndpoint} refused the client_credentials grant (${response.status} ${response.statusText}${detail ? `, ${detail}` : ''}); check OBP_OAUTH_CLIENT_ID / OBP_OAUTH_CLIENT_SECRET and that the client allows client_credentials`
			);
		}
		const tokens = (await response.json()) as { access_token?: string; expires_in?: number };
		if (!tokens.access_token) return fail(`${tokenEndpoint} returned no access_token`);
		const ttlMs = (typeof tokens.expires_in === 'number' ? tokens.expires_in : 300) * 1000;
		cache.set(clientId!, { accessToken: tokens.access_token, expiresAt: Date.now() + ttlMs });
		return { token: tokens.access_token };
	} catch (err) {
		return fail(`could not reach ${tokenEndpoint}: ${err instanceof Error ? err.message : String(err)}`);
	}
}

/** As requestApplicationAccessToken, for callers that only need the token or null. */
export async function getApplicationAccessToken(
	client: OAuth2ClientWithConfig | undefined,
	clientId: string | undefined,
	clientSecret: string | undefined,
	refreshMarginMs = 60_000
): Promise<string | null> {
	return (await requestApplicationAccessToken(client, clientId, clientSecret, refreshMarginMs)).token;
}
