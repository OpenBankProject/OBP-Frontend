import type { HealthCheckSnapshot } from './state/HealthCheckState';

export type OverallStatus = 'healthy' | 'unhealthy' | 'unknown';

export interface ServiceHealthView extends HealthCheckSnapshot {
    /** True when the last result is too old to say anything about the present. */
    stale?: boolean;
}

export interface HealthSummary {
    timestamp: string;
    overallStatus: OverallStatus;
    healthPercentage: number;
    services: Record<string, ServiceHealthView>;
    summary: {
        total: number;
        healthy: number;
        unhealthy: number;
        unknown: number;
        stale: number;
    };
}

// Fallback when a snapshot doesn't carry its check interval.
const DEFAULT_STALE_AFTER_MS = 3 * 60_000;

/**
 * Compute the overall status from health check snapshots without optimistic bias:
 * - No monitored services means we know nothing — 'unknown', never 'healthy'.
 * - A result older than two check intervals proves nothing about the present;
 *   it is flagged stale and counted as 'unknown'.
 * - 'healthy' requires every service to have a fresh, healthy result.
 */
export function summarizeHealth(
    snapshots: Record<string, HealthCheckSnapshot>,
    now: Date = new Date()
): HealthSummary {
    const services: Record<string, ServiceHealthView> = {};
    for (const [name, snapshot] of Object.entries(snapshots)) {
        const ageMs = now.getTime() - new Date(snapshot.lastChecked).getTime();
        const staleAfterMs = snapshot.intervalMs ? snapshot.intervalMs * 2 : DEFAULT_STALE_AFTER_MS;
        const stale = snapshot.status !== 'unknown' && ageMs > staleAfterMs;
        services[name] = stale ? { ...snapshot, stale: true } : { ...snapshot };
    }

    const list = Object.values(services);
    const effectiveStatus = (s: ServiceHealthView) => (s.stale ? 'unknown' : s.status);
    const healthy = list.filter((s) => effectiveStatus(s) === 'healthy').length;
    const unhealthy = list.filter((s) => effectiveStatus(s) === 'unhealthy').length;
    const unknown = list.filter((s) => effectiveStatus(s) === 'unknown').length;

    let overallStatus: OverallStatus;
    if (list.length === 0) {
        overallStatus = 'unknown';
    } else if (unhealthy > 0) {
        overallStatus = 'unhealthy';
    } else if (unknown > 0) {
        overallStatus = 'unknown';
    } else {
        overallStatus = 'healthy';
    }

    return {
        timestamp: now.toISOString(),
        overallStatus,
        healthPercentage: list.length > 0 ? Math.round((healthy / list.length) * 100) : 0,
        services,
        summary: {
            total: list.length,
            healthy,
            unhealthy,
            unknown,
            stale: list.filter((s) => s.stale).length
        }
    };
}
