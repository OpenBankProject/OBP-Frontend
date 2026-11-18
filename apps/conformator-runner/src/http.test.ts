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
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { send, Unreachable } from './http';

let server: Server;
let base: string;

beforeAll(async () => {
	server = createServer((req, res) => {
		if (req.url === '/slow') return; // never answers
		let body = '';
		req.on('data', (c) => (body += c));
		req.on('end', () => {
			res.setHeader('x-fapi-interaction-id', String(req.headers['x-fapi-interaction-id'] ?? ''));
			res.setHeader('content-type', 'application/json');
			res.statusCode = req.method === 'POST' ? 201 : 200;
			res.end(JSON.stringify({ method: req.method, body }));
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
	server.closeAllConnections();
	server.close();
});

describe('send', () => {
	it('sends the method, headers and body, and returns the answer with lower-case header names', async () => {
		const res = await send({ method: 'POST', url: `${base}/consents`, headers: { 'X-FAPI-Interaction-ID': 'i1' }, body: '{"a":1}', timeoutMs: 2000 });
		expect(res.status).toBe(201);
		expect(res.headers['x-fapi-interaction-id']).toBe('i1');
		expect(JSON.parse(res.text)).toEqual({ method: 'POST', body: '{"a":1}' });
	});

	it('reports a system that does not answer in time as unreachable', async () => {
		await expect(send({ method: 'GET', url: `${base}/slow`, headers: {}, timeoutMs: 200 })).rejects.toBeInstanceOf(Unreachable);
	});

	it('reports a refused connection as unreachable', async () => {
		await expect(send({ method: 'GET', url: 'http://127.0.0.1:1/x', headers: {}, timeoutMs: 1000 })).rejects.toBeInstanceOf(Unreachable);
	});
});
