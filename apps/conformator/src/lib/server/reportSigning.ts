/*
 * Copyright (C) 2026 TESOBE GmbH
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
import { createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { readFileSync } from 'node:fs';

/**
 * Signing conformance reports. A report's content is written as canonical JSON (keys sorted, no spaces), hashed with
 * SHA-256, and the hash is signed with Ed25519. Anyone can check a report with the public key, which the app publishes.
 */

/** JSON with object keys in sorted order and no spaces, so the same content always gives the same text. */
export function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, v]) => v !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** `sha256:<hex>` of a text. */
export function hashOf(text: string): string {
	return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

/** A short id for a public key: the first 16 hex characters of the SHA-256 of its DER form. */
export function keyIdOf(publicKey: KeyObject): string {
	return createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16);
}

export interface Signer {
	keyId: string;
	publicKeyPem: string;
	/** The base64 Ed25519 signature of a hash text. */
	sign(hash: string): string;
}

/** A signer from an Ed25519 private key in PEM (PKCS#8). Refuses any other kind of key. */
export function signerFromPem(pem: string): Signer {
	const privateKey = createPrivateKey(pem);
	if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error(`The report signing key must be Ed25519, not ${privateKey.asymmetricKeyType}.`);
	const publicKey = createPublicKey(privateKey);
	return {
		keyId: keyIdOf(publicKey),
		publicKeyPem: String(publicKey.export({ type: 'spki', format: 'pem' })),
		sign: (hash) => sign(null, Buffer.from(hash, 'utf8'), privateKey).toString('base64')
	};
}

/** A signer from the file named by REPORT_SIGNING_KEY_FILE, or null with the reason when there is none. */
export function signerFromFile(path: string | undefined): { signer: Signer | null; problem: string | null } {
	if (!path) return { signer: null, problem: 'REPORT_SIGNING_KEY_FILE is not set, so no report can be signed or issued.' };
	try {
		return { signer: signerFromPem(readFileSync(path, 'utf8')), problem: null };
	} catch (err) {
		return { signer: null, problem: `The report signing key in ${path} could not be used: ${err instanceof Error ? err.message : String(err)}` };
	}
}

export type Verification = { hashMatches: boolean; signatureValid: boolean; keyKnown: boolean };

/** Check a report: its content gives its hash, and the signature over the hash is valid for the published key. */
export function verifyReport(content: string, hash: string, signature: string, keyId: string, publicKeyPem: string | null): Verification {
	const hashMatches = hashOf(content) === hash;
	if (!publicKeyPem) return { hashMatches, signatureValid: false, keyKnown: false };
	const publicKey = createPublicKey(publicKeyPem);
	const keyKnown = keyIdOf(publicKey) === keyId;
	let signatureValid = false;
	try {
		signatureValid = keyKnown && verify(null, Buffer.from(hash, 'utf8'), publicKey, Buffer.from(signature, 'base64'));
	} catch {
		signatureValid = false;
	}
	return { hashMatches, signatureValid, keyKnown };
}
