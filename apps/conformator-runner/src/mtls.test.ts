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
import { createServer, type Server } from 'node:https';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { send, Unreachable } from './http';
import { makeTestCertificates } from './testCertificates';

let server: Server;
let base: string;
let certs: ReturnType<typeof makeTestCertificates>;

beforeAll(async () => {
	certs = makeTestCertificates();
	server = createServer({ cert: certs.serverCert, key: certs.serverKey, ca: certs.ca, requestCert: true, rejectUnauthorized: true }, (req, res) => {
		const peer = (req.socket as import('node:tls').TLSSocket).getPeerCertificate();
		res.end(JSON.stringify({ client: peer.subject?.CN }));
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	base = `https://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 30_000);

afterAll(() => {
	server.closeAllConnections();
	server.close();
});

describe('send over mutual TLS', () => {
	it('presents the runner certificate, and the server sees it', async () => {
		const res = await send({ method: 'GET', url: `${base}/accounts`, headers: {}, timeoutMs: 5000, tls: { cert: certs.clientCert, key: certs.clientKey, ca: certs.ca } });
		expect(res.status).toBe(200);
		expect(JSON.parse(res.text)).toEqual({ client: 'runner' });
	});

	it('is refused, as unreachable, without a client certificate', async () => {
		// Trusts the server's CA, but has no certificate of its own to present.
		await expect(send({ method: 'GET', url: `${base}/accounts`, headers: {}, timeoutMs: 5000, tls: { cert: '', key: '', ca: certs.ca } })).rejects.toBeInstanceOf(Unreachable);
	});

	it('does not trust a server certificate from an unknown CA', async () => {
		await expect(send({ method: 'GET', url: `${base}/accounts`, headers: {}, timeoutMs: 5000, tls: { cert: certs.clientCert, key: certs.clientKey } })).rejects.toBeInstanceOf(Unreachable);
	});
});
