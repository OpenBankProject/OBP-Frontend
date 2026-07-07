import { describe, it, expect } from 'vitest';
import { renderTextWithLinks } from './links';

describe('renderTextWithLinks', () => {
	it('returns plain text unchanged (escaped)', () => {
		expect(renderTextWithLinks('Hello world')).toBe('Hello world');
	});

	it('escapes HTML in plain text', () => {
		expect(renderTextWithLinks('<b>bold</b> & "quotes"')).toBe(
			'&lt;b&gt;bold&lt;/b&gt; &amp; &quot;quotes&quot;'
		);
	});

	it('converts an https link and opens it in a new tab', () => {
		expect(renderTextWithLinks('See [the docs](https://example.com/docs) for more')).toBe(
			'See <a href="https://example.com/docs" target="_blank" rel="noopener noreferrer">the docs</a> for more'
		);
	});

	it('converts a site-relative link without target=_blank', () => {
		expect(renderTextWithLinks('Go to [registration](/register)')).toBe(
			'Go to <a href="/register">registration</a>'
		);
	});

	it('converts a mailto link without target=_blank', () => {
		expect(renderTextWithLinks('[Contact us](mailto:hello@example.com)')).toBe(
			'<a href="mailto:hello@example.com">Contact us</a>'
		);
	});

	it('handles multiple links in one string', () => {
		expect(renderTextWithLinks('[a](/x) and [b](/y)')).toBe(
			'<a href="/x">a</a> and <a href="/y">b</a>'
		);
	});

	it('applies the linkClass option', () => {
		expect(renderTextWithLinks('[docs](/docs)', { linkClass: 'underline' })).toBe(
			'<a href="/docs" class="underline">docs</a>'
		);
	});

	it('leaves javascript: URLs as escaped literal text', () => {
		expect(renderTextWithLinks('[click](javascript:alert(1))')).toBe(
			'[click](javascript:alert(1))'
		);
	});

	it('leaves protocol-relative URLs as literal text', () => {
		expect(renderTextWithLinks('[click](//evil.example)')).toBe('[click](//evil.example)');
	});

	it('escapes HTML inside the link label and URL', () => {
		expect(renderTextWithLinks('["quoted" <label>](/path?a=1&b=2)')).toBe(
			'<a href="/path?a=1&amp;b=2">&quot;quoted&quot; &lt;label&gt;</a>'
		);
	});

	it('does not treat bare brackets as a link', () => {
		expect(renderTextWithLinks('array[0] and (note)')).toBe('array[0] and (note)');
	});
});
