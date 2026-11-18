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
import type { RunnerScope } from '@obp/shared/conformator';
import type { Config } from './config';

/** A dynamic entity record as OBP-API returns it. */
export type EntityRecord = Record<string, any>;

/** A call to OBP-API that failed: its HTTP status (0 when OBP-API could not be reached) and OBP's message. */
export class ObpError extends Error {
	constructor(
		message: string,
		readonly status: number
	) {
		super(message);
	}
}

/** What the runner asks of OBP-API. Kept small, so tests can use a fake. */
export interface ObpApi {
	list(entity: string, space: string, access?: 'public'): Promise<EntityRecord[]>;
	get(entity: string, space: string, id: string, access?: 'public'): Promise<EntityRecord>;
	create(entity: string, space: string, body: EntityRecord): Promise<EntityRecord>;
	update(entity: string, space: string, id: string, body: EntityRecord): Promise<EntityRecord>;
	/** Tell OBP-API which Scopes the runner needs; returns OBP's answer in words. */
	declarePlatformApp(scopes: RunnerScope[], version: string): Promise<string>;
	/** The runner's own consumer_id, for the web app's CONFORMATOR_RUNNER_CONSUMER_ID. */
	consumerId(): Promise<string>;
}

/** The runner's own access token: found through OIDC discovery, then the client credentials grant. Cached until near expiry. */
class TokenSource {
	private tokenEndpoint: string | null = null;
	private cached: { token: string; expiresAt: number } | null = null;

	constructor(private readonly config: Config) {}

	async token(): Promise<string> {
		if (this.cached && this.cached.expiresAt - 60_000 > Date.now()) return this.cached.token;
		if (!this.tokenEndpoint) {
			const url = `${this.config.oidcIssuer}/.well-known/openid-configuration`;
			const response = await fetch(url).catch((err) => {
				throw new ObpError(`OIDC discovery at ${url} could not be reached: ${err.message}`, 0);
			});
			if (!response.ok) throw new ObpError(`OIDC discovery at ${url} answered ${response.status}.`, response.status);
			this.tokenEndpoint = String(((await response.json()) as { token_endpoint?: string }).token_endpoint ?? '');
			if (!this.tokenEndpoint) throw new ObpError(`OIDC discovery at ${url} gave no token_endpoint.`, 0);
		}
		const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: this.config.clientId, client_secret: this.config.clientSecret });
		const response = await fetch(this.tokenEndpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
			body
		}).catch((err) => {
			throw new ObpError(`The token endpoint ${this.tokenEndpoint} could not be reached: ${err.message}`, 0);
		});
		if (!response.ok)
			throw new ObpError(
				`${this.tokenEndpoint} refused the client credentials grant (${response.status}). Check OBP_OAUTH_CLIENT_ID and OBP_OAUTH_CLIENT_SECRET.`,
				response.status
			);
		const json = (await response.json()) as { access_token?: string; expires_in?: number };
		this.cached = { token: String(json.access_token), expiresAt: Date.now() + Number(json.expires_in ?? 300) * 1000 };
		return this.cached.token;
	}
}

/** OBP-API over HTTP, as the runner's own Consumer. */
export function obpApi(config: Config): ObpApi {
	const tokens = new TokenSource(config);

	async function call(method: string, path: string, body?: unknown): Promise<any> {
		const token = await tokens.token();
		const url = `${config.obpBaseUrl}${path}`;
		const response = await fetch(url, {
			method,
			headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
			...(body ? { body: JSON.stringify(body) } : {}),
			signal: AbortSignal.timeout(30_000)
		}).catch((err) => {
			throw new ObpError(`OBP-API could not be reached at ${url}: ${err.message}`, 0);
		});
		const json = (await response.json().catch(() => null)) as any;
		if (!response.ok) throw new ObpError(String(json?.message ?? `${method} ${path} answered ${response.status}`), response.status);
		return json;
	}

	const path = (space: string, entity: string, access?: 'public', id?: string) =>
		`/obp/v7.0.0/banks/${encodeURIComponent(space)}/dynamic-entities/${access ? `${access}/` : ''}${encodeURIComponent(entity)}${id ? `/${encodeURIComponent(id)}` : ''}`;

	return {
		async list(entity, space, access) {
			const json = await call('GET', path(space, entity, access));
			return ((json?.[`${entity}_list`] ?? []) as any[]).map((item) => item?.[entity]).filter(Boolean);
		},
		async get(entity, space, id, access) {
			return (await call('GET', path(space, entity, access, id)))?.[entity];
		},
		async create(entity, space, body) {
			return (await call('POST', path(space, entity), body))?.[entity];
		},
		async update(entity, space, id, body) {
			return (await call('PUT', path(space, entity, undefined, id), body))?.[entity];
		},
		async consumerId() {
			return String((await call('GET', '/obp/v7.0.0/consumers/current/scopes'))?.consumer_id ?? '');
		},
		async declarePlatformApp(scopes, version) {
			try {
				await call('PUT', '/obp/v7.0.0/consumers/current/platform-app', {
					version,
					required_scopes: scopes.map((s) => ({ ...s, optional: false }))
				});
				return 'accepted';
			} catch (err) {
				return `not accepted: ${err instanceof Error ? err.message : String(err)}`;
			}
		}
	};
}
