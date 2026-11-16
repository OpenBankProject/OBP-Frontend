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
import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalJson, hashOf, signerFromPem, verifyReport } from './reportSigning';

const pem = () => String(generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }));

describe('canonicalJson', () => {
	it('sorts keys at every depth and drops undefined', () => {
		expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: null }], c: undefined } })).toBe('{"a":{"d":[2,{"y":null,"z":1}]},"b":1}');
	});

	it('gives the same text whatever the order the keys were written in', () => {
		expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }));
	});
});

describe('signing and verifying a report', () => {
	const signer = signerFromPem(pem());
	const content = canonicalJson({ reference: 'CR-1', tests: [{ test_id: 'A-1', outcome: 'pass' }] });
	const hash = hashOf(content);
	const signature = signer.sign(hash);

	it('verifies an untouched report', () => {
		expect(verifyReport(content, hash, signature, signer.keyId, signer.publicKeyPem)).toEqual({ hashMatches: true, signatureValid: true, keyKnown: true });
	});

	it('notices changed content', () => {
		const changed = content.replace('pass', 'fail');
		expect(verifyReport(changed, hash, signature, signer.keyId, signer.publicKeyPem).hashMatches).toBe(false);
	});

	it('notices a signature made with another key', () => {
		const other = signerFromPem(pem());
		expect(verifyReport(content, hash, other.sign(hash), signer.keyId, signer.publicKeyPem).signatureValid).toBe(false);
		// The report names one key, but the published key is another.
		expect(verifyReport(content, hash, signature, signer.keyId, other.publicKeyPem)).toMatchObject({ keyKnown: false, signatureValid: false });
	});

	it('refuses a key that is not Ed25519', () => {
		const rsa = String(generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }));
		expect(() => signerFromPem(rsa)).toThrow(/must be Ed25519/);
	});
});
