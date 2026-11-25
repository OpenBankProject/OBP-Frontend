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

/**
 * Checks whether a saved token's signature still matches one of the keys its OAuth2 provider publishes now. When a
 * provider changes its signing key, for example OBP-OIDC restarting without OIDC_SIGNING_KEY_FILE, tokens it signed
 * before are rejected by OBP-API with "Invalid signature", though they have not expired. This check lets the saved
 * application token be replaced before it is used.
 */
import { constants, createPublicKey, verify, type JsonWebKeyInput, type KeyObject } from 'node:crypto';
import { createLogger } from '$shared/utils/logger';

const logger = createLogger('SigningKeyCheck');

/** How long the provider's published keys are reused before they are fetched again. */
export const PUBLISHED_KEYS_TTL_MS = 60_000;

/** One key of a provider's JWKS, as it publishes it. */
interface PublishedKey {
	kty?: string;
	kid?: string;
	use?: string;
	alg?: string;
	[member: string]: unknown;
}

const publishedKeysCache = new Map<string, { fetchedAt: number; keys: PublishedKey[] }>();

/** The hash and, for elliptic curve keys, the signature encoding each JWS algorithm uses. */
const ALGORITHMS: Record<string, { hash: string; padding?: 'pss'; ecdsa?: boolean }> = {
	RS256: { hash: 'sha256' },
	RS384: { hash: 'sha384' },
	RS512: { hash: 'sha512' },
	PS256: { hash: 'sha256', padding: 'pss' },
	PS384: { hash: 'sha384', padding: 'pss' },
	PS512: { hash: 'sha512', padding: 'pss' },
	ES256: { hash: 'sha256', ecdsa: true },
	ES384: { hash: 'sha384', ecdsa: true },
	ES512: { hash: 'sha512', ecdsa: true }
};

/** The keys published at jwksUri, from the cache when they were fetched less than a minute ago; null if they cannot be read. */
async function publishedKeys(jwksUri: string): Promise<PublishedKey[] | null> {
	const cached = publishedKeysCache.get(jwksUri);
	if (cached && Date.now() - cached.fetchedAt < PUBLISHED_KEYS_TTL_MS) return cached.keys;
	try {
		const response = await fetch(jwksUri, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
		if (!response.ok) {
			logger.warn(`Could not read the published keys at ${jwksUri}: ${response.status} ${response.statusText}`);
			return null;
		}
		const body = (await response.json()) as { keys?: PublishedKey[] };
		const keys = Array.isArray(body.keys) ? body.keys : [];
		publishedKeysCache.set(jwksUri, { fetchedAt: Date.now(), keys });
		return keys;
	} catch (err) {
		logger.warn(`Could not read the published keys at ${jwksUri}: ${err instanceof Error ? err.message : String(err)}`);
		return null;
	}
}

function signatureMatchesKey(signedPart: Buffer, signature: Buffer, algorithm: (typeof ALGORITHMS)[string], jwk: PublishedKey): boolean {
	let publicKey: KeyObject;
	try {
		publicKey = createPublicKey({ key: jwk, format: 'jwk' } as JsonWebKeyInput);
	} catch {
		return false;
	}
	try {
		if (algorithm.ecdsa) return verify(algorithm.hash, signedPart, { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature);
		if (algorithm.padding === 'pss') return verify(algorithm.hash, signedPart, { key: publicKey, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: constants.RSA_PSS_SALTLEN_DIGEST }, signature);
		return verify(algorithm.hash, signedPart, publicKey, signature);
	} catch {
		return false;
	}
}

/**
 * Whether the token's signature matches a key published at jwksUri now: true if it does, false if it does not, and
 * null if that cannot be told (the keys cannot be read, or the token is not a signed JWT in a form this checks). A
 * caller should replace the token only on false, so an outage of the provider does not throw away a working token.
 */
export async function signatureMatchesPublishedKeys(token: string, jwksUri: string): Promise<boolean | null> {
	const parts = token.split('.');
	if (parts.length !== 3) return null;
	const [encodedHeader, encodedPayload, encodedSignature] = parts;
	let header: { alg?: string; kid?: string };
	try {
		header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
	} catch {
		return null;
	}
	const algorithm = header.alg ? ALGORITHMS[header.alg] : undefined;
	if (!algorithm) return null;

	const keys = await publishedKeys(jwksUri);
	if (keys === null) return null;
	// Only keys for signing, and with the token's key name if it has one. No such key means the key was replaced.
	const candidates = keys.filter((k) => (k.use === undefined || k.use === 'sig') && (!header.kid || k.kid === header.kid));
	if (candidates.length === 0) return false;

	const signedPart = Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8');
	const signature = Buffer.from(encodedSignature, 'base64url');
	return candidates.some((jwk) => signatureMatchesKey(signedPart, signature, algorithm, jwk));
}

/** Forget the fetched keys, for tests. */
export function clearPublishedKeysCache(): void {
	publishedKeysCache.clear();
}
