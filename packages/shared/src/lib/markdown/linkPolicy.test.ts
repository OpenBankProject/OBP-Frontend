import { describe, it, expect } from 'vitest';
import {
	collectLinkHosts,
	isAllowedLinkHref,
	filterLinksByHost,
	stripDangerousCharacters
} from './linkPolicy.js';

const HOSTS = ['openbankproject.com', 'k8s-portal.openbankproject.com'];

describe('collectLinkHosts', () => {
	it('extracts lowercase hostnames from config URLs', () => {
		expect(
			collectLinkHosts(['https://API.Example.com:8080/path', 'http://apimanager.example.com'])
		).toEqual(['api.example.com', 'apimanager.example.com']);
	});

	it('accepts bare hostnames and skips empties and junk', () => {
		expect(collectLinkHosts(['github.com', undefined, null, '', 'not a host!'])).toEqual([
			'github.com'
		]);
	});

	it('deduplicates', () => {
		expect(collectLinkHosts(['https://a.com/x', 'https://a.com/y'])).toEqual(['a.com']);
	});
});

describe('isAllowedLinkHref', () => {
	it('allows relative links, anchors and mailto', () => {
		expect(isAllowedLinkHref('/user/chat', HOSTS)).toBe(true);
		expect(isAllowedLinkHref('#section', HOSTS)).toBe(true);
		expect(isAllowedLinkHref('?page=2', HOSTS)).toBe(true);
		expect(isAllowedLinkHref('mailto:contact@tesobe.com', HOSTS)).toBe(true);
	});

	it('allows exact and subdomain matches of allowed hosts', () => {
		expect(isAllowedLinkHref('https://openbankproject.com/about', HOSTS)).toBe(true);
		expect(isAllowedLinkHref('https://grpc.openbankproject.com', HOSTS)).toBe(true);
		expect(isAllowedLinkHref('HTTPS://OPENBANKPROJECT.COM', HOSTS)).toBe(true);
	});

	it('rejects other hosts', () => {
		expect(isAllowedLinkHref('https://evil.example/login', HOSTS)).toBe(false);
	});

	it('is immune to substring tricks', () => {
		expect(isAllowedLinkHref('https://openbankproject.com.evil.example/', HOSTS)).toBe(false);
		expect(isAllowedLinkHref('https://evil.example/openbankproject.com', HOSTS)).toBe(false);
		expect(isAllowedLinkHref('https://user@openbankproject.com.evil.example/', HOSTS)).toBe(false);
		expect(isAllowedLinkHref('https://evilopenbankproject.com', HOSTS)).toBe(false);
	});

	it('treats loopback names as equivalent when any loopback host is allowed', () => {
		const devHosts = ['127.0.0.1'];
		expect(isAllowedLinkHref('http://localhost:5174/user/chat', devHosts)).toBe(true);
		expect(isAllowedLinkHref('http://127.0.0.1:8080/obp', devHosts)).toBe(true);
		expect(isAllowedLinkHref('http://portal.localhost/x', devHosts)).toBe(true);
		// but not when no loopback host is allowed (production)
		expect(isAllowedLinkHref('http://localhost:8080/x', HOSTS)).toBe(false);
	});

	it('judges protocol-relative URLs by host', () => {
		expect(isAllowedLinkHref('//openbankproject.com/x', HOSTS)).toBe(true);
		expect(isAllowedLinkHref('//evil.example/x', HOSTS)).toBe(false);
	});

	it('rejects non-http schemes', () => {
		expect(isAllowedLinkHref('javascript:alert(1)', HOSTS)).toBe(false);
		expect(isAllowedLinkHref('ftp://openbankproject.com/file', HOSTS)).toBe(false);
	});
});

describe('filterLinksByHost', () => {
	it('keeps allowed links clickable', () => {
		const html = '<p><a href="https://openbankproject.com/docs">docs</a></p>';
		expect(filterLinksByHost(html, HOSTS)).toBe(html);
	});

	it('unwraps disallowed links to plain text', () => {
		const html = '<p>see <a href="https://evil.example/login">our login page</a> now</p>';
		expect(filterLinksByHost(html, HOSTS)).toBe(
			'<p>see <span class="blocked-link">our login page</span> now</p>'
		);
	});

	it('handles a mix of links and keeps other markup', () => {
		const html =
			'<p><a href="/user">me</a> <strong>x</strong> <a href="https://evil.example">bad</a></p>';
		expect(filterLinksByHost(html, HOSTS)).toBe(
			'<p><a href="/user">me</a> <strong>x</strong> <span class="blocked-link">bad</span></p>'
		);
	});
});

describe('stripDangerousCharacters', () => {
	it('removes bidi override/isolate characters that can visually reverse text', () => {
		expect(stripDangerousCharacters('see \u202Emoc.elgoog\u202C now')).toBe('see moc.elgoog now');
		expect(stripDangerousCharacters('a\u2066b\u2067c\u2068d\u2069e')).toBe('abcde');
	});

	it('removes control characters but keeps newline, tab and CR', () => {
		expect(stripDangerousCharacters('a\u0000\u0007b\u009Fc\u200Fd')).toBe('abcd');
		expect(stripDangerousCharacters('line1\nline2\ttabbed\r')).toBe('line1\nline2\ttabbed\r');
	});

	it('leaves normal text including RTL scripts untouched', () => {
		expect(stripDangerousCharacters('مرحبا Hello עברית')).toBe('مرحبا Hello עברית');
	});
});
