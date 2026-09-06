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
import type { RequestHandler } from './$types';
import { healthCheckRegistry } from '../../../hooks.server';
import { get } from 'svelte/store';

export const GET: RequestHandler = async () => {
	// Get current health check snapshots from the registry
	const healthSnapshots = get(healthCheckRegistry.getStore());

	// Calculate overall system status
	const services = Object.values(healthSnapshots);
	const hasUnhealthy = services.some(s => s.status === 'unhealthy');
	const hasUnknown = services.some(s => s.status === 'unknown');
	const allHealthy = services.every(s => s.status === 'healthy');

	let overallStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

	if (allHealthy) {
		overallStatus = 'healthy';
	} else if (hasUnhealthy) {
		overallStatus = 'unhealthy';
	} else if (hasUnknown) {
		overallStatus = 'unknown';
	} else {
		overallStatus = 'degraded';
	}

	// Calculate health percentage
	const healthyCount = services.filter(s => s.status === 'healthy').length;
	const totalCount = services.length;
	const healthPercentage = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0;

	const response = {
		timestamp: new Date().toISOString(),
		overallStatus,
		healthPercentage,
		services: healthSnapshots,
		summary: {
			total: totalCount,
			healthy: healthyCount,
			unhealthy: services.filter(s => s.status === 'unhealthy').length,
			unknown: services.filter(s => s.status === 'unknown').length,
		}
	};

	return json(response, { status: 200 });
};
