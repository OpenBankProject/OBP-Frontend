// Tests for the shared rate-limit helpers used by hooks.server.ts. They live
// here rather than in packages/shared because shared's vitest config excludes
// src/lib/server/** (its jsdom environment can't load the Node-only modules
// that directory otherwise contains).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	parseRateLimit,
	formatRate,
	rateLimitMessage,
	checkClientAddress,
	_resetClientAddressWarnings
} from '@obp/shared/server/rate-limit';

describe('parseRateLimit', () => {
	const fallback = [3, '15m'] as const;

	it('returns the fallback when the variable is unset or blank', () => {
		expect(parseRateLimit('X', undefined, [...fallback])).toEqual([3, '15m']);
		expect(parseRateLimit('X', '', [...fallback])).toEqual([3, '15m']);
		expect(parseRateLimit('X', '   ', [...fallback])).toEqual([3, '15m']);
	});

	it('parses "<count>/<window>"', () => {
		expect(parseRateLimit('X', '20/15m', [...fallback])).toEqual([20, '15m']);
		expect(parseRateLimit('X', '30/m', [...fallback])).toEqual([30, 'm']);
		expect(parseRateLimit('X', ' 5 / H ', [...fallback])).toEqual([5, 'h']);
	});

	it('falls back on malformed values instead of disabling the limit', () => {
		for (const bad of ['20', '20/', '/15m', '0/15m', '-1/m', 'lots/15m', '20/15min', '20/2d', '20 per 15m']) {
			expect(parseRateLimit('X', bad, [...fallback]), bad).toEqual([3, '15m']);
		}
	});
});

describe('formatRate', () => {
	it('round-trips', () => {
		expect(formatRate(parseRateLimit('X', '20/15m', [1, 'm']))).toBe('20/15m');
	});
});

describe('rateLimitMessage', () => {
	it('quotes seconds for short waits and minutes for long ones', () => {
		expect(rateLimitMessage({ retryAfter: 1 })).toContain('about 1 second ');
		expect(rateLimitMessage({ retryAfter: 45 })).toContain('about 45 seconds');
		expect(rateLimitMessage({ retryAfter: 600 })).toContain('about 10 minutes');
		expect(rateLimitMessage({ retryAfter: 601 })).toContain('about 11 minutes');
	});

	it('never says "0 seconds"', () => {
		expect(rateLimitMessage({ retryAfter: 0 })).toContain('about 1 second ');
	});
});

describe('checkClientAddress', () => {
	const event = (address: () => string, forwarded?: string) => ({
		request: new Request('http://localhost/register', {
			method: 'POST',
			headers: forwarded ? { 'x-forwarded-for': forwarded } : {}
		}),
		getClientAddress: address
	});

	beforeEach(() => {
		_resetClientAddressWarnings();
		vi.restoreAllMocks();
	});

	it('returns the resolved address', () => {
		expect(checkClientAddress(event(() => '203.0.113.7'))).toBe('203.0.113.7');
	});

	it('warns once when X-Forwarded-For is present but not honoured', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const e = event(() => '10.0.0.5', '203.0.113.7, 10.0.0.1');
		expect(checkClientAddress(e)).toBe('10.0.0.5');
		expect(checkClientAddress(e)).toBe('10.0.0.5');
		const relevant = warn.mock.calls.filter((c) => String(c.join(' ')).includes('not being honoured'));
		expect(relevant).toHaveLength(1);
		expect(String(relevant[0].join(' '))).toContain('ADDRESS_HEADER=x-forwarded-for');
	});

	it('stays quiet when the address matches a forwarded hop', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(checkClientAddress(event(() => '203.0.113.7', '203.0.113.7, 10.0.0.1'))).toBe('203.0.113.7');
		expect(warn.mock.calls.some((c) => String(c.join(' ')).includes('not being honoured'))).toBe(false);
	});

	it('returns null and logs an error once when the address cannot be determined', () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const e = event(() => {
			throw new Error('Address header was specified with ADDRESS_HEADER=x-forwarded-for but is absent from request');
		});
		expect(checkClientAddress(e)).toBeNull();
		expect(checkClientAddress(e)).toBeNull();
		const relevant = error.mock.calls.filter((c) => String(c.join(' ')).includes('UNLIMITED'));
		expect(relevant).toHaveLength(1);
	});
});
