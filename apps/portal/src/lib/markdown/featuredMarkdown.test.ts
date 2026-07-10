import { describe, it, expect } from 'vitest';
import { markdownToHtml, sanitizeLinkHref } from './featuredMarkdown';

describe('markdownToHtml link sanitization', () => {
	it('neutralizes an attribute-breakout attempt in a link href', () => {
		const html = markdownToHtml('[hi](x" onmouseover=alert`1`)');
		expect(html).toContain('href="#"');
		expect(html).not.toContain('onmouseover');
		// The stray double-quote must never survive as an unescaped attribute delimiter.
		expect(html).not.toContain('href="x"');
	});

	it('rewrites a javascript: link to a safe anchor', () => {
		const html = markdownToHtml('[x](javascript:alert(1))');
		expect(html).toContain('href="#"');
		expect(html).not.toContain('javascript:');
	});

	it('rewrites a data: link to a safe anchor', () => {
		const html = markdownToHtml('[x](data:text/html,<script>alert(1)</script>)');
		expect(html).toContain('href="#"');
		expect(html).not.toContain('data:text/html');
	});

	it('rejects a protocol-relative link', () => {
		const html = markdownToHtml('[x](//evil.com)');
		expect(html).toContain('href="#"');
		expect(html).not.toContain('href="//evil.com"');
	});

	it('rejects a backslash-prefixed link', () => {
		const html = markdownToHtml('[x](/\\evil.com)');
		expect(html).toContain('href="#"');
	});

	it('keeps an absolute https link', () => {
		const html = markdownToHtml('[ok](https://example.com/path)');
		expect(html).toContain('href="https://example.com/path"');
	});

	it('keeps a site-relative link', () => {
		const html = markdownToHtml('[rel](/docs)');
		expect(html).toContain('href="/docs"');
	});

	it('keeps a fragment link', () => {
		const html = markdownToHtml('[frag](#section)');
		expect(html).toContain('href="#section"');
	});
});

describe('sanitizeLinkHref', () => {
	it('escapes ampersands, quotes, and angle brackets in a safe href', () => {
		const result = sanitizeLinkHref('/search?a=1&b=2"><x');
		expect(result).not.toMatch(/[<>"]/);
		expect(result).not.toContain('&b'); // bare ampersand is escaped
	});

	it('collapses unsafe schemes to a hash', () => {
		expect(sanitizeLinkHref('vbscript:msgbox(1)')).toBe('#');
		expect(sanitizeLinkHref('//host')).toBe('#');
		expect(sanitizeLinkHref('/\\host')).toBe('#');
	});

	it('trims surrounding whitespace before validating', () => {
		expect(sanitizeLinkHref('  https://example.com  ')).toBe('https://example.com');
	});
});

describe('markdownToHtml text escaping', () => {
	it('escapes raw HTML in the markdown body', () => {
		const html = markdownToHtml('an <img src=x onerror=alert(1)> tag');
		expect(html).toContain('&lt;img');
		expect(html).not.toContain('<img');
	});
});
