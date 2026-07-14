import { describe, it, expect } from 'vitest';
import { summarizeHealth } from './summarize';
import type { HealthCheckSnapshot } from './state/HealthCheckState';

const NOW = new Date('2026-01-01T12:00:00Z');

function snapshot(overrides: Partial<HealthCheckSnapshot> = {}): HealthCheckSnapshot {
	return {
		service: 'Test',
		status: 'healthy',
		lastChecked: NOW.toISOString(),
		conecutiveFailures: 0,
		intervalMs: 60_000,
		...overrides
	};
}

describe('summarizeHealth', () => {
	it('reports unknown, not healthy, when no services are monitored', () => {
		const result = summarizeHealth({}, NOW);
		expect(result.overallStatus).toBe('unknown');
		expect(result.healthPercentage).toBe(0);
		expect(result.summary.total).toBe(0);
	});

	it('reports healthy only when every service has a fresh healthy result', () => {
		const result = summarizeHealth(
			{ a: snapshot({ service: 'A' }), b: snapshot({ service: 'B' }) },
			NOW
		);
		expect(result.overallStatus).toBe('healthy');
		expect(result.healthPercentage).toBe(100);
	});

	it('reports unhealthy when any service is unhealthy', () => {
		const result = summarizeHealth(
			{ a: snapshot(), b: snapshot({ status: 'unhealthy', error: 'boom' }) },
			NOW
		);
		expect(result.overallStatus).toBe('unhealthy');
		expect(result.summary.unhealthy).toBe(1);
	});

	it('reports partial when at least one OAuth2 provider is healthy and another is not', () => {
		const result = summarizeHealth(
			{
				'OBP API': snapshot({ service: 'OBP API' }),
				'OAuth2: obp-oidc': snapshot({ service: 'OAuth2: obp-oidc' }),
				'OAuth2: google': snapshot({
					service: 'OAuth2: google',
					status: 'unhealthy',
					error: 'GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET must be set'
				})
			},
			NOW
		);
		expect(result.overallStatus).toBe('partial');
		expect(result.summary.unhealthy).toBe(1);
	});

	it('reports unhealthy when no OAuth2 provider is healthy', () => {
		const result = summarizeHealth(
			{
				'OBP API': snapshot({ service: 'OBP API' }),
				'OAuth2: obp-oidc': snapshot({
					service: 'OAuth2: obp-oidc',
					status: 'unhealthy',
					error: 'fetch failed'
				}),
				'OAuth2: google': snapshot({
					service: 'OAuth2: google',
					status: 'unhealthy',
					error: 'missing credentials'
				})
			},
			NOW
		);
		expect(result.overallStatus).toBe('unhealthy');
	});

	it('reports unhealthy when a core service is down even if OAuth2 is only partial', () => {
		const result = summarizeHealth(
			{
				Redis: snapshot({ service: 'Redis', status: 'unhealthy', error: 'ECONNREFUSED' }),
				'OAuth2: obp-oidc': snapshot({ service: 'OAuth2: obp-oidc' }),
				'OAuth2: google': snapshot({
					service: 'OAuth2: google',
					status: 'unhealthy',
					error: 'missing credentials'
				})
			},
			NOW
		);
		expect(result.overallStatus).toBe('unhealthy');
	});

	it('does not report partial when a stale OAuth2 provider is the only healthy-looking one', () => {
		const fiveMinutesAgo = new Date(NOW.getTime() - 5 * 60_000).toISOString();
		const result = summarizeHealth(
			{
				'OAuth2: obp-oidc': snapshot({
					service: 'OAuth2: obp-oidc',
					lastChecked: fiveMinutesAgo
				}),
				'OAuth2: google': snapshot({
					service: 'OAuth2: google',
					status: 'unhealthy',
					error: 'missing credentials'
				})
			},
			NOW
		);
		expect(result.overallStatus).toBe('unhealthy');
	});

	it('reports unknown when a service has not yet been checked', () => {
		const result = summarizeHealth({ a: snapshot(), b: snapshot({ status: 'unknown' }) }, NOW);
		expect(result.overallStatus).toBe('unknown');
		expect(result.summary.unknown).toBe(1);
	});

	it('flags results older than two check intervals as stale and counts them as unknown', () => {
		const fiveMinutesAgo = new Date(NOW.getTime() - 5 * 60_000).toISOString();
		const result = summarizeHealth({ a: snapshot({ lastChecked: fiveMinutesAgo }) }, NOW);
		expect(result.services.a.stale).toBe(true);
		expect(result.overallStatus).toBe('unknown');
		expect(result.summary.unknown).toBe(1);
		expect(result.summary.stale).toBe(1);
		expect(result.healthPercentage).toBe(0);
	});

	it('does not flag a fresh result as stale', () => {
		const result = summarizeHealth({ a: snapshot() }, NOW);
		expect(result.services.a.stale).toBeUndefined();
	});

	it('does not double-report an unknown result as stale', () => {
		const longAgo = new Date(0).toISOString();
		const result = summarizeHealth(
			{ a: snapshot({ status: 'unknown', lastChecked: longAgo }) },
			NOW
		);
		expect(result.services.a.stale).toBeUndefined();
		expect(result.summary.stale).toBe(0);
	});
});
