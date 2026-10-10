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
import { createHash } from 'crypto';

// Whether an OBP-API token may see what this app guards with an OBP Role. OBP-API answers, through
// GET /obp/v7.0.0/banks/SYS/my/roles/ROLE_NAME, with the same rules its own endpoints use: the token's
// User holds the Role, or its Consumer holds it as a Scope (auth mode UserOrApplication).

export type RoleCheck = 'allowed' | 'unauthorized' | 'forbidden';

const TTL_MS = 60_000;
const MAX_CACHED = 1000;
const cache = new Map<string, { result: RoleCheck; at: number }>();

export function clearRoleCheckCache(): void {
	cache.clear();
}

async function checkRole(obpApiHost: string, token: string, role: string): Promise<RoleCheck> {
	const response = await fetch(
		`${obpApiHost}/obp/v7.0.0/banks/SYS/my/roles/${encodeURIComponent(role)}`,
		{ headers: { Authorization: `Bearer ${token}` } }
	);
	if (response.status === 401) return 'unauthorized';
	if (!response.ok) {
		if (response.status === 404)
			console.warn(`Role check: OBP-API does not know ${role}, or has no /my/roles endpoint`);
		return 'forbidden';
	}
	const body = await response.json();
	return body.allowed_for_auth_modes?.includes('UserOrApplication') ? 'allowed' : 'forbidden';
}

/** Allowed if the token may use any one of the Roles, as an endpoint needing any of them would decide. */
export async function tokenMayUseAnyRole(
	obpApiHost: string,
	token: string,
	roles: string[],
	now: number = Date.now()
): Promise<RoleCheck> {
	const key = createHash('sha256').update(token).digest('hex') + ':' + roles.join(',');
	const cached = cache.get(key);
	if (cached && now - cached.at < TTL_MS) return cached.result;
	let result: RoleCheck = 'forbidden';
	for (const role of roles) {
		result = await checkRole(obpApiHost, token, role);
		if (result !== 'forbidden') break;
	}
	if (cache.size >= MAX_CACHED) {
		for (const [k, v] of cache) if (now - v.at >= TTL_MS) cache.delete(k);
		if (cache.size >= MAX_CACHED) cache.clear();
	}
	cache.set(key, { result, at: now });
	return result;
}

function jsonError(status: number, error: string): Response {
	return new Response(JSON.stringify({ error }), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

/**
 * null if the request's OBP-API token may use any of the Roles, otherwise the response refusing it. The
 * token is a Bearer header (a monitor such as OBP-Sentinel) or, without one, the logged-in User's token
 * from this app's session (a browser).
 */
export async function refuseUnlessAnyObpRole(
	request: Request,
	obpApiHost: string | undefined,
	roles: string[],
	sessionToken?: string
): Promise<Response | null> {
	const header = request.headers.get('authorization') ?? '';
	const bearer = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
	const token = bearer || sessionToken || '';
	if (!token) return jsonError(401, 'Log in, or send a Bearer token from OBP-API');
	if (!obpApiHost) return jsonError(503, 'PUBLIC_OBP_BASE_URL is not set');
	try {
		const result = await tokenMayUseAnyRole(obpApiHost, token, roles);
		if (result === 'allowed') return null;
		if (result === 'unauthorized') return jsonError(401, 'OBP-API did not accept the token');
		return jsonError(403, `Requires one of the Roles: ${roles.join(', ')}`);
	} catch (error) {
		console.error('Role check: could not ask OBP-API:', error);
		return jsonError(503, 'Could not check the token with OBP-API');
	}
}
