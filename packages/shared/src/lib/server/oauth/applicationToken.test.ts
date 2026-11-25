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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto';
import { clearApplicationTokenCache, requestApplicationAccessToken } from './applicationToken';
import { clearPublishedKeysCache, signatureMatchesPublishedKeys } from './signingKeyCheck';
import type { OAuth2ClientWithConfig } from './client';

const TOKEN_ENDPOINT = 'https://oidc.example.com/obp-oidc/token';
const JWKS_URI = 'https://oidc.example.com/obp-oidc/jwks';
const client = { OIDCConfig: { token_endpoint: TOKEN_ENDPOINT, jwks_uri: JWKS_URI } } as unknown as OAuth2ClientWithConfig;

/** A provider like OBP-OIDC without OIDC_SIGNING_KEY_FILE: one key, always named oidc-key-1, replaced on restart. */
function newSigningKey() {
	return generateKeyPairSync('rsa', { modulusLength: 2048 });
}
let signingKey = newSigningKey();
let tokensIssued = 0;
let jwksAnswers = true;

function signedToken(privateKey: KeyObject, kid = 'oidc-key-1'): string {
	const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid })).toString('base64url');
	const payload = Buffer.from(JSON.stringify({ sub: 'portal', n: ++tokensIssued })).toString('base64url');
	const signature = sign('sha256', Buffer.from(`${header}.${payload}`), privateKey).toString('base64url');
	return `${header}.${payload}.${signature}`;
}

function fakeProvider(url: string | URL | Request): Response {
	const address = String(url);
	if (address === TOKEN_ENDPOINT) {
		return new Response(JSON.stringify({ access_token: signedToken(signingKey.privateKey), expires_in: 3600 }), { status: 200 });
	}
	if (address === JWKS_URI) {
		if (!jwksAnswers) return new Response('unavailable', { status: 503 });
		const jwk = signingKey.publicKey.export({ format: 'jwk' });
		return new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'oidc-key-1', use: 'sig', alg: 'RS256' }] }), { status: 200 });
	}
	return new Response('not found', { status: 404 });
}

const fetchMock = vi.fn(async (url: string | URL | Request) => fakeProvider(url));
const tokenRequests = () => fetchMock.mock.calls.filter(([url]) => String(url) === TOKEN_ENDPOINT).length;
const getToken = async () => {
	const result = await requestApplicationAccessToken(client, 'portal-client', 'portal-secret');
	if (result.token === null) throw new Error(result.reason);
	return result.token;
};

beforeEach(() => {
	vi.useFakeTimers({ toFake: ['Date'] });
	vi.setSystemTime(new Date('2026-11-24T10:00:00Z'));
	vi.stubGlobal('fetch', fetchMock);
	fetchMock.mockClear();
	signingKey = newSigningKey();
	jwksAnswers = true;
	clearApplicationTokenCache();
	clearPublishedKeysCache();
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('requestApplicationAccessToken', () => {
	it('reuses the saved token while the provider still publishes its key', async () => {
		const first = await getToken();
		vi.advanceTimersByTime(5 * 60_000);
		expect(await getToken()).toBe(first);
		expect(tokenRequests()).toBe(1);
	});

	it('gets a new token when the provider has changed its signing key under the same key name', async () => {
		const first = await getToken();
		signingKey = newSigningKey(); // the provider restarts with a new key, still called oidc-key-1
		vi.advanceTimersByTime(2 * 60_000);
		const second = await getToken();
		expect(second).not.toBe(first);
		expect(tokenRequests()).toBe(2);
		expect(await signatureMatchesPublishedKeys(second, JWKS_URI)).toBe(true);
	});

	it('keeps the saved token when the published keys cannot be read', async () => {
		const first = await getToken();
		signingKey = newSigningKey();
		jwksAnswers = false;
		vi.advanceTimersByTime(2 * 60_000);
		expect(await getToken()).toBe(first);
		expect(tokenRequests()).toBe(1);
	});

	it('checks the saved token at most once a minute', async () => {
		await getToken();
		for (let i = 0; i < 5; i++) await getToken();
		expect(fetchMock.mock.calls.filter(([url]) => String(url) === JWKS_URI)).toHaveLength(0);
		vi.advanceTimersByTime(61_000);
		for (let i = 0; i < 5; i++) await getToken();
		expect(fetchMock.mock.calls.filter(([url]) => String(url) === JWKS_URI)).toHaveLength(1);
	});
});

describe('signatureMatchesPublishedKeys', () => {
	it('says false for a key name the provider no longer publishes', async () => {
		expect(await signatureMatchesPublishedKeys(signedToken(signingKey.privateKey, 'oidc-key-0'), JWKS_URI)).toBe(false);
	});

	it('cannot tell for something that is not a signed JWT', async () => {
		expect(await signatureMatchesPublishedKeys('opaque-token', JWKS_URI)).toBeNull();
	});
});
