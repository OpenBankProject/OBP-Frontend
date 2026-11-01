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
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

/**
 * What the first of Opey's status lights reads, in the Portal's shape: whether Cohort's server reaches Opey
 * (OPEY_BASE_URL). Checked on each call, with a short timeout.
 */
export const GET: RequestHandler = async ({ fetch }) => {
	const base = env.OPEY_BASE_URL;
	if (!base) return json({ services: { 'Opey (server)': { status: 'unhealthy', detail: 'OPEY_BASE_URL is not set' } } });
	let opey: { status: 'healthy' | 'unhealthy'; detail?: string };
	try {
		const res = await fetch(`${base.replace(/\/$/, '')}/status`, { signal: AbortSignal.timeout(5000) });
		opey = res.ok ? { status: 'healthy' } : { status: 'unhealthy', detail: `HTTP ${res.status} from ${base}/status` };
	} catch (err) {
		opey = { status: 'unhealthy', detail: `${base}: ${err instanceof Error ? err.message : String(err)}` };
	}
	return json({ services: { 'Opey (server)': { ...opey, details: { OPEY_BASE_URL: base } } } });
};
