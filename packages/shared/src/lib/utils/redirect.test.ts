import { describe, it, expect } from 'vitest';
import { isSafeRelativeRedirect } from './redirect';

describe('isSafeRelativeRedirect', () => {
	it('rejects null', () => {
		expect(isSafeRelativeRedirect(null)).toBe(false);
	});

	it('rejects undefined', () => {
		expect(isSafeRelativeRedirect(undefined)).toBe(false);
	});

	it('rejects an empty string', () => {
		expect(isSafeRelativeRedirect('')).toBe(false);
	});

	it('accepts a simple site-relative path', () => {
		expect(isSafeRelativeRedirect('/dashboard')).toBe(true);
	});

	it('accepts the root path', () => {
		expect(isSafeRelativeRedirect('/')).toBe(true);
	});

	it('accepts a relative path with query string', () => {
		expect(isSafeRelativeRedirect('/a/b?c=d')).toBe(true);
	});

	it('rejects a protocol-relative URL', () => {
		expect(isSafeRelativeRedirect('//evil.com')).toBe(false);
	});

	it('rejects a backslash-prefixed path that browsers resolve to another host', () => {
		expect(isSafeRelativeRedirect('/\\evil.com')).toBe(false);
	});

	it('rejects an absolute http(s) URL', () => {
		expect(isSafeRelativeRedirect('https://evil.com')).toBe(false);
	});

	it('rejects a path without a leading slash', () => {
		expect(isSafeRelativeRedirect('dashboard')).toBe(false);
	});
});
