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

/** The runner's settings, each read from one environment variable. */
export interface Config {
	obpBaseUrl: string;
	oidcIssuer: string;
	clientId: string;
	clientSecret: string;
	centralSpace: string;
	pollSeconds: number;
	concurrency: number;
	credentialsDir: string;
	requestTimeoutMs: number;
	/** The OpenID conformance suite, if the runner uses one. */
	openIdSuite: { baseUrl: string; token?: string; caFile?: string; moduleTimeoutMs: number } | null;
}

/** Read the settings, and list every one that is missing or wrong, so they can all be fixed at once. */
export function readConfig(env: Record<string, string | undefined>): { config: Config; problems: string[] } {
	const problems: string[] = [];
	const required = (name: string) => {
		const value = env[name]?.trim() ?? '';
		if (!value) problems.push(`${name} is not set.`);
		return value;
	};
	const positive = (name: string, fallback: number) => {
		const raw = env[name]?.trim();
		if (!raw) return fallback;
		const value = Number(raw);
		if (!Number.isFinite(value) || value <= 0) {
			problems.push(`${name} must be a number above 0, not "${raw}".`);
			return fallback;
		}
		return value;
	};
	const config: Config = {
		obpBaseUrl: required('OBP_BASE_URL').replace(/\/+$/, ''),
		oidcIssuer: required('OIDC_ISSUER').replace(/\/+$/, ''),
		clientId: required('OBP_OAUTH_CLIENT_ID'),
		clientSecret: required('OBP_OAUTH_CLIENT_SECRET'),
		centralSpace: env.OBP_ENTITY_SPACE_ID?.trim() || 'conformator',
		pollSeconds: positive('RUNNER_POLL_SECONDS', 15),
		concurrency: Math.floor(positive('RUNNER_CONCURRENCY', 2)),
		credentialsDir: env.RUNNER_CREDENTIALS_DIR?.trim() || './credentials',
		requestTimeoutMs: positive('RUNNER_REQUEST_TIMEOUT_SECONDS', 30) * 1000,
		openIdSuite: null
	};
	const suiteUrl = env.OPENID_SUITE_URL?.trim();
	if (suiteUrl) {
		if (!/^https?:\/\/\S+$/.test(suiteUrl)) problems.push(`OPENID_SUITE_URL must be an http(s) URL, not "${suiteUrl}".`);
		config.openIdSuite = {
			baseUrl: suiteUrl.replace(/\/+$/, ''),
			token: env.OPENID_SUITE_TOKEN?.trim() || undefined,
			caFile: env.OPENID_SUITE_CA_FILE?.trim() || undefined,
			moduleTimeoutMs: positive('OPENID_SUITE_MODULE_TIMEOUT_SECONDS', 600) * 1000
		};
	}
	return { config, problems };
}
