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
/**
 * A fake bank for trying Conformator on a laptop: a small HTTPS server that asks for a client certificate
 * (mTLS), gives tokens by the client credentials grant, and answers a few account information calls in OMR with three
 * decimals. It is not a reference implementation of anything; it exists so a first run has something to talk to.
 *
 *   node dev/fake-bank.mjs                       # https://localhost:8443, certificates from dev/certs
 *   FAKE_BANK_BREAK=consent-status node dev/fake-bank.mjs     # answers a new consent with the wrong status
 *   FAKE_BANK_BREAK=balance-decimals node dev/fake-bank.mjs   # gives balances with two decimals, not three
 *
 * Make the certificates first with dev/make-dev-certs.sh.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const certs = process.env.FAKE_BANK_CERTS ?? join(here, 'certs');
const port = Number(process.env.FAKE_BANK_PORT ?? 8443);
const base = `https://localhost:${port}`;
const broken = process.env.FAKE_BANK_BREAK ?? '';

/** The client id this bank issued to the runner, and the test customer's token. */
const RUNNER_CLIENT_ID = 'conformator-runner';
const CUSTOMER_TOKEN = 'demo-customer-token';

const clientTokens = new Set();
const consents = new Map();

const accounts = [
	{ account_id: 'acc-001', currency: 'OMR', nickname: 'Current account', balance: '1520.375' },
	{ account_id: 'acc-002', currency: 'OMR', nickname: 'Savings', balance: '10250.000' }
];

function send(res, status, body, interactionId) {
	res.setHeader('x-fapi-interaction-id', interactionId || randomUUID());
	if (body === undefined) {
		res.statusCode = status;
		return res.end();
	}
	res.setHeader('content-type', 'application/json');
	res.statusCode = status;
	res.end(JSON.stringify(body));
}

function bearer(req) {
	const match = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
	return match ? match[1] : null;
}

const server = createServer(
	{
		cert: readFileSync(join(certs, 'server.crt')),
		key: readFileSync(join(certs, 'server.key')),
		ca: readFileSync(join(certs, 'ca.crt')),
		requestCert: true,
		rejectUnauthorized: true,
		minVersion: 'TLSv1.2'
	},
	(req, res) => {
		let raw = '';
		req.on('data', (c) => (raw += c));
		req.on('end', () => {
			const id = String(req.headers['x-fapi-interaction-id'] ?? '');
			const url = new URL(req.url ?? '/', base);
			const path = url.pathname;
			const json = () => {
				try {
					return JSON.parse(raw || '{}');
				} catch {
					return null;
				}
			};
			console.log(`${new Date().toISOString()} ${req.method} ${path}`);

			if (req.method === 'GET' && path === '/.well-known/openid-configuration')
				return send(res, 200, { issuer: base, token_endpoint: `${base}/token`, token_endpoint_auth_methods_supported: ['tls_client_auth'] }, id);

			if (req.method === 'POST' && path === '/token') {
				const form = new URLSearchParams(raw);
				if (form.get('grant_type') !== 'client_credentials') return send(res, 400, { error: 'unsupported_grant_type' }, id);
				if (form.get('client_id') !== RUNNER_CLIENT_ID) return send(res, 401, { error: 'invalid_client' }, id);
				const token = randomUUID();
				clientTokens.add(token);
				return send(res, 200, { access_token: token, token_type: 'Bearer', expires_in: 300 }, id);
			}

			const consentPath = /^\/open-banking\/v1\/account-access-consents(?:\/([^/]+))?$/.exec(path);
			if (consentPath) {
				if (!clientTokens.has(bearer(req))) return send(res, 401, { error: 'invalid_token' }, id);
				const consentId = consentPath[1];
				if (req.method === 'POST' && !consentId) {
					const body = json();
					if (!body || !Array.isArray(body.permissions) || body.permissions.length === 0)
						return send(res, 400, { error: 'invalid_request', message: 'permissions are required' }, id);
					const consent = {
						consent_id: randomUUID(),
						status: broken === 'consent-status' ? 'Authorised' : 'AwaitingAuthorisation',
						permissions: body.permissions,
						created_at: new Date().toISOString()
					};
					consents.set(consent.consent_id, consent);
					return send(res, 201, { data: consent }, id);
				}
				const consent = consents.get(consentId);
				if (!consent) return send(res, 404, { error: 'not_found' }, id);
				if (req.method === 'GET') return send(res, 200, { data: consent }, id);
				if (req.method === 'DELETE') {
					consent.status = 'Revoked';
					return send(res, 204, undefined, id);
				}
			}

			if (req.method === 'GET' && path === '/open-banking/v1/accounts') {
				if (bearer(req) !== CUSTOMER_TOKEN) return send(res, 401, { error: 'invalid_token' }, id);
				return send(res, 200, { data: accounts.map(({ balance: _b, ...a }) => a) }, id);
			}

			const balance = /^\/open-banking\/v1\/accounts\/([^/]+)\/balances$/.exec(path);
			if (req.method === 'GET' && balance) {
				if (bearer(req) !== CUSTOMER_TOKEN) return send(res, 401, { error: 'invalid_token' }, id);
				const account = accounts.find((a) => a.account_id === balance[1]);
				if (!account) return send(res, 404, { error: 'not_found' }, id);
				const amount = broken === 'balance-decimals' ? Number(account.balance).toFixed(2) : account.balance;
				return send(res, 200, { data: { account_id: account.account_id, amount, currency: account.currency } }, id);
			}

			send(res, 404, { error: 'not_found' }, id);
		});
	}
);

server.listen(port, () => console.log(`Fake bank on ${base}${broken ? ` (broken: ${broken})` : ''}. Base URL for the system: ${base}/open-banking/v1`));
