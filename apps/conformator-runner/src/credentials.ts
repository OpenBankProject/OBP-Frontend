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
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TlsMaterial } from './http';

/**
 * What the runner needs to work with a participant's system, kept out of OBP-API. One folder per system id
 * under RUNNER_CREDENTIALS_DIR, holding any of:
 *
 * - `client.crt` and `client.key`: the runner's certificate and key for mTLS with that system.
 * - `ca.crt`: the CA that signs the system's server certificate, when it is not a public one.
 * - `secrets.json`: `client_secret` (for the client the system issued to the runner), `client_id` (instead of the
 *   system record's, for a client id that should not be shown, such as the runner's own at the OBP sandbox), `token_endpoint` (when the system
 *   has no discovery URL), `scope`, and `customer_access_token` (a test customer's token, until the runner can get
 *   consent on the bank's own screens).
 * - `openid-config.json`: the participant's configuration for the OpenID conformance suite (its server's discovery
 *   URL, the test clients with their keys and certificates, and the browser steps that log a test user in), used by
 *   `openid:plan` checks.
 */
export interface SystemCredentials {
	tls?: TlsMaterial;
	clientSecret?: string;
	clientId?: string;
	tokenEndpoint?: string;
	scope?: string;
	customerAccessToken?: string;
	openidConfig?: unknown;
}

/** A system id safe to use as a folder name: no dots or slashes, so it cannot leave the credentials folder. */
export function isSafeId(id: string): boolean {
	return /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

async function optional(path: string): Promise<string | undefined> {
	try {
		return await readFile(path, 'utf8');
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
		throw err;
	}
}

/** The credentials for a system; empty when it has none. A broken secrets.json is an error, never ignored. */
export async function loadCredentials(dir: string, systemId: string): Promise<SystemCredentials> {
	if (!isSafeId(systemId)) throw new Error(`The system id "${systemId}" cannot be used as a folder name.`);
	const folder = join(dir, systemId);
	const [cert, key, ca, secretsText, openidText] = await Promise.all(
		['client.crt', 'client.key', 'ca.crt', 'secrets.json', 'openid-config.json'].map((f) => optional(join(folder, f)))
	);
	if (Boolean(cert) !== Boolean(key)) throw new Error(`${folder} has ${cert ? 'client.crt but no client.key' : 'client.key but no client.crt'}.`);
	let secrets: Record<string, unknown> = {};
	if (secretsText) {
		try {
			secrets = JSON.parse(secretsText);
		} catch (err) {
			throw new Error(`${join(folder, 'secrets.json')} is not valid JSON: ${(err as Error).message}`);
		}
	}
	let openidConfig: unknown;
	if (openidText) {
		try {
			openidConfig = JSON.parse(openidText);
		} catch (err) {
			throw new Error(`${join(folder, 'openid-config.json')} is not valid JSON: ${(err as Error).message}`);
		}
	}
	const text = (name: string) => (typeof secrets[name] === 'string' && secrets[name] !== '' ? (secrets[name] as string) : undefined);
	return {
		...(cert && key ? { tls: { cert, key, ...(ca ? { ca } : {}) } } : {}),
		clientSecret: text('client_secret'),
		clientId: text('client_id'),
		tokenEndpoint: text('token_endpoint'),
		scope: text('scope'),
		customerAccessToken: text('customer_access_token'),
		...(openidConfig !== undefined ? { openidConfig } : {})
	};
}
