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
import { LOG_LEVELS, logTail, type LogCacheLevel } from './logCache.js';
import { telemetryReport } from './telemetry.js';
import { refuseUnlessAnyObpRole } from './obpRoleCheck.js';

// This app's log cache and Telemetry, for a monitor such as OBP-Sentinel, guarded by the same Roles
// OBP-API's own log cache and Telemetry endpoints need. Served by each app's /monitoring routes.

const capitalised = (level: string) => level.charAt(0).toUpperCase() + level.slice(1);

function nonNegativeInt(value: string | null): number | undefined {
	if (value === null) return undefined;
	const n = Number(value);
	return Number.isInteger(n) && n >= 0 ? n : undefined;
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

/** GET /monitoring/log-cache/LEVEL, LEVEL one of trace, debug, info, warning, error, all. */
export async function logCacheResponse(
	level: string,
	request: Request,
	url: URL,
	obpApiHost: string | undefined,
	sessionToken?: string
): Promise<Response> {
	if (level !== 'all' && !(LOG_LEVELS as readonly string[]).includes(level))
		return json({ error: `Unknown log level: ${level}` }, 404);
	const roles =
		level === 'all'
			? ['CanGetSystemLogCacheAll']
			: [`CanGetSystemLogCache${capitalised(level)}`, 'CanGetSystemLogCacheAll'];
	const refused = await refuseUnlessAnyObpRole(request, obpApiHost, roles, sessionToken);
	if (refused) return refused;
	return json(
		logTail(
			level as LogCacheLevel | 'all',
			nonNegativeInt(url.searchParams.get('limit')),
			nonNegativeInt(url.searchParams.get('offset'))
		)
	);
}

/** GET /monitoring/telemetry, optionally ?name_prefix=... */
export async function telemetryResponse(
	request: Request,
	url: URL,
	obpApiHost: string | undefined,
	gitCommit: string,
	sessionToken?: string
): Promise<Response> {
	const refused = await refuseUnlessAnyObpRole(request, obpApiHost, ['CanGetTelemetry'], sessionToken);
	if (refused) return refused;
	return json(telemetryReport(gitCommit, url.searchParams.get('name_prefix') ?? undefined));
}
