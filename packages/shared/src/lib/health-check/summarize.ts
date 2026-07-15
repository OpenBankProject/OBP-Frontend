import type { HealthCheckSnapshot } from './state/HealthCheckState';

export type OverallStatus = 'healthy' | 'partial' | 'unhealthy' | 'unknown';

// Provider checks registered as 'OAuth2: <provider>' form one login group:
// users need only one working provider, so a broken provider alongside a
// healthy one degrades the system to 'partial' rather than 'unhealthy'.
const OAUTH2_GROUP_PREFIX = 'OAuth2: ';

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
 * - OAuth2 provider checks are one group: as long as one provider is healthy,
 *   failed providers yield 'partial' instead of 'unhealthy'. With no healthy
 *   provider left (or a non-OAuth service down), the status is 'unhealthy'.
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

    const entries = Object.entries(services);
    const isOAuth2 = ([name]: [string, ServiceHealthView]) => name.startsWith(OAUTH2_GROUP_PREFIX);
    const coreStatuses = entries.filter((e) => !isOAuth2(e)).map(([, s]) => effectiveStatus(s));
    const oauthStatuses = entries.filter(isOAuth2).map(([, s]) => effectiveStatus(s));
    const oauthHealthy = oauthStatuses.filter((s) => s === 'healthy').length;
    const oauthUnhealthy = oauthStatuses.filter((s) => s === 'unhealthy').length;

    let overallStatus: OverallStatus;
    if (list.length === 0) {
        overallStatus = 'unknown';
    } else if (coreStatuses.includes('unhealthy') || (oauthUnhealthy > 0 && oauthHealthy === 0)) {
        overallStatus = 'unhealthy';
    } else if (oauthUnhealthy > 0) {
        overallStatus = 'partial';
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
