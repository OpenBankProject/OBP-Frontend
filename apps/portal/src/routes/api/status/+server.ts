import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { healthCheckRegistry } from '$lib/health-check/HealthCheckRegistry';
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
