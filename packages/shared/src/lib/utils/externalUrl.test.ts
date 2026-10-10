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
import { describe, it, expect } from 'vitest';
import {
	externalRedirectProblem,
	isSafeExternalRedirect,
	redirectUrlEntries,
	firstSafeExternalRedirect,
	isSafeLinkUrl,
	safeLinkHref
} from './externalUrl';

describe('isSafeExternalRedirect', () => {
	it('accepts https, loopback http and reverse-domain app schemes', () => {
		for (const url of [
			'https://a.com/cb',
			'https://a.com/cb?x=1',
			'http://localhost:5173/cb',
			'http://127.0.0.1:8080/cb',
			'http://[::1]:8080/cb',
			'com.example.app:/cb',
			'com.example.tppapp://redirect'
		]) {
			expect(isSafeExternalRedirect(url), url).toBe(true);
		}
	});

	it('refuses script schemes, wildcards, user information, fragments and public http', () => {
		for (const url of [
			'javascript:alert(1)',
			'JavaScript:alert(1)',
			'data:text/html,x',
			'vbscript:x',
			'file:///etc/passwd',
			'https://*.a.com/cb',
			'https://user@evil.com/cb',
			'https://a.com/cb#x',
			'http://example.com/cb',
			'tppapp://example.com/redirect',
			'/relative',
			'https:\\\\evil.com',
			'java\tscript:alert(1)',
			'',
			null
		]) {
			expect(isSafeExternalRedirect(url), String(url)).toBe(false);
		}
	});

	it('says why an entry is refused', () => {
		expect(externalRedirectProblem('http://example.com/cb')).toContain('localhost');
	});
});

describe('redirect URL entries', () => {
	it('splits on commas and whitespace', () => {
		expect(redirectUrlEntries('https://a.com/cb, https://b.com/cb\nhttp://localhost/cb')).toEqual([
			'https://a.com/cb',
			'https://b.com/cb',
			'http://localhost/cb'
		]);
		expect(redirectUrlEntries(null)).toEqual([]);
	});

	it('picks the first entry that may be used', () => {
		expect(firstSafeExternalRedirect('javascript:x, https://a.com/cb')).toBe('https://a.com/cb');
		expect(firstSafeExternalRedirect('javascript:x http://example.com')).toBeNull();
	});
});

describe('isSafeLinkUrl', () => {
	it('only links http and https URLs with a host', () => {
		expect(isSafeLinkUrl('https://a.com/x')).toBe(true);
		expect(isSafeLinkUrl('http://example.com/x')).toBe(true);
		for (const url of ['javascript:alert(1)', 'data:text/html,x', 'com.example.app:/cb', 'https://user@a.com', '', null]) {
			expect(isSafeLinkUrl(url), String(url)).toBe(false);
		}
	});
});

describe('safeLinkHref', () => {
	it('keeps a safe link and drops an unsafe one', () => {
		expect(safeLinkHref('https://a.com/x')).toBe('https://a.com/x');
		expect(safeLinkHref('javascript:alert(1)')).toBeUndefined();
	});
});
