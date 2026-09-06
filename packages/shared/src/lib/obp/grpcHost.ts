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
// OBP-API deployments conventionally expose gRPC on a `grpc.` subdomain of the
// REST host. Behind a public (https) deployment that subdomain serves gRPC
// through the ingress on port 443 with TLS — a raw high port is typically not
// reachable there — so when OBP_GRPC_HOST is unset the default is
// grpc.<PUBLIC_OBP_BASE_URL hostname>:443 with TLS for https deployments, and
// port 50051 without TLS for http (dev) ones. localhost and IP literals get no
// `grpc.` prefix (there is no subdomain to resolve there).

export const DEFAULT_GRPC_PORT = 50051;
export const DEFAULT_GRPC_TLS_PORT = 443;

export interface GrpcTarget {
	/** gRPC target as host:port (no scheme). */
	host: string;
	/** Whether to dial with TLS channel credentials. */
	tls: boolean;
}

/**
 * The gRPC target to connect to, resolved from an env-like record:
 * OBP_GRPC_HOST when set, otherwise derived from PUBLIC_OBP_BASE_URL.
 * TLS follows OBP_GRPC_TLS ("true"/"false") when set, otherwise the port:
 * 443 means TLS. Pass `process.env`, or spread SvelteKit's dynamic env
 * objects: `resolveGrpcTarget({ ...env, ...publicEnv })`.
 */
export function resolveGrpcTarget(env: {
	OBP_GRPC_HOST?: string;
	OBP_GRPC_TLS?: string;
	PUBLIC_OBP_BASE_URL?: string;
}): GrpcTarget {
	const host = env.OBP_GRPC_HOST || defaultGrpcHost(env.PUBLIC_OBP_BASE_URL);
	const tls =
		env.OBP_GRPC_TLS !== undefined
			? env.OBP_GRPC_TLS === 'true'
			: host.endsWith(`:${DEFAULT_GRPC_TLS_PORT}`);
	return { host, tls };
}

export function defaultGrpcHost(obpBaseUrl: string | undefined | null): string {
	if (obpBaseUrl) {
		try {
			const url = new URL(obpBaseUrl);
			if (grpcSubdomainApplies(url.hostname)) {
				const port = url.protocol === 'https:' ? DEFAULT_GRPC_TLS_PORT : DEFAULT_GRPC_PORT;
				return `grpc.${url.hostname}:${port}`;
			}
			return `${url.hostname}:${DEFAULT_GRPC_PORT}`;
		} catch {
			// unparseable base URL — fall through to localhost
		}
	}
	return `localhost:${DEFAULT_GRPC_PORT}`;
}

function grpcSubdomainApplies(hostname: string): boolean {
	if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
		return false;
	}
	// IPv4 literal; IPv6 literals contain ':' (URL.hostname keeps their brackets)
	return !/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) && !hostname.includes(':');
}
