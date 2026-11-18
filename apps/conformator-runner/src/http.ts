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
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

/** The runner's client certificate and key for mTLS (when it has them), and the CA that signs the server's certificate. */
export interface TlsMaterial {
	cert?: string;
	key?: string;
	ca?: string;
}

export interface OutgoingRequest {
	method: string;
	url: string;
	headers: Record<string, string>;
	body?: string;
	tls?: TlsMaterial;
	timeoutMs: number;
}

export interface IncomingResponse {
	status: number;
	headers: Record<string, string>;
	text: string;
}

/** The participant's system could not be reached or did not answer: a connection, TLS or timeout failure. */
export class Unreachable extends Error {}

export type Send = (request: OutgoingRequest) => Promise<IncomingResponse>;

/** Send one request with Node's own HTTP client, so the client certificate is used for mTLS. TLS 1.2 at least. */
export const send: Send = (req) =>
	new Promise((resolve, reject) => {
		const url = new URL(req.url);
		const secure = url.protocol === 'https:';
		const options = {
			method: req.method,
			headers: { ...req.headers, ...(req.body !== undefined ? { 'content-length': Buffer.byteLength(req.body).toString() } : {}) },
			timeout: req.timeoutMs,
			...(secure
				? {
						minVersion: 'TLSv1.2' as const,
						...(req.tls?.cert && req.tls.key ? { cert: req.tls.cert, key: req.tls.key } : {}),
						...(req.tls?.ca ? { ca: req.tls.ca } : {})
					}
				: {})
		};
		const outgoing = (secure ? httpsRequest : httpRequest)(url, options, (res) => {
			const chunks: Buffer[] = [];
			res.on('data', (c: Buffer) => chunks.push(c));
			res.on('end', () => {
				const headers: Record<string, string> = {};
				for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
				resolve({ status: res.statusCode ?? 0, headers, text: Buffer.concat(chunks).toString('utf8') });
			});
			res.on('error', (err) => reject(new Unreachable(`The response from ${url.host} broke off: ${err.message}`)));
		});
		outgoing.on('timeout', () => outgoing.destroy(new Unreachable(`${url.host} did not answer within ${req.timeoutMs / 1000} seconds.`)));
		outgoing.on('error', (err) => reject(err instanceof Unreachable ? err : new Unreachable(`${url.host} could not be reached: ${err.message}`)));
		if (req.body !== undefined) outgoing.write(req.body);
		outgoing.end();
	});
