import { describe, it, expect } from 'vitest';
import { expandLiveTags, escapeHtml, safeUrl, type LandingFetchers } from './expand.js';
import { describeLandingBlocksForOpey, LIVE_TAGS, BEHAVIOURS } from './registry.js';
import { LANDING_BEHAVIOUR_NAMES } from './behaviours.js';

function fetchers(overrides: Partial<LandingFetchers> = {}): LandingFetchers {
	return {
		products: async ({ tag, limit }) =>
			[
				{ bank_id: 'b1', api_product_code: 'p1', name: 'Payments <Pro>', description: 'Move "money"', category: 'Payments', price_monthly: 50, price_currency: 'EUR' },
				{ bank_id: 'b1', api_product_code: 'p2', name: 'Free Data', price_monthly: 0 }
			]
				.filter(() => tag !== 'none')
				.slice(0, limit),
		endpoints: async ({ collection, limit }) =>
			collection === 'c1'
				? [{ operation_id: 'OBPv6.0.0-getBanks', request_verb: 'GET', request_url: '/obp/v6.0.0/banks', summary: 'Get Banks' }].slice(0, limit)
				: [],
		banks: async () => [{ id: 'gh.29.uk', full_name: 'The Bank', logo: 'https://x/logo.png', website: 'javascript:alert(1)' }],
		stat: async (kind) => (kind === 'endpoint-count' ? 812 : 'n/a'),
		links: {
			product: (p) => `/products/${p.api_product_code}`,
			endpoint: (e) => `https://explorer/operationid/${e.operation_id}`,
			signup: '/register'
		},
		...overrides
	};
}

describe('expandLiveTags', () => {
	it('renders product cards with escaped values and a link', async () => {
		const out = await expandLiveTags('<h1>Hi</h1><obp-products tag="featured" limit="1"></obp-products>', fetchers());
		expect(out).toContain('<h1>Hi</h1>');
		expect(out).toContain('class="obp-products obp-products--cards"');
		expect(out).toContain('Payments &lt;Pro&gt;');
		expect(out).toContain('Move &quot;money&quot;');
		expect(out).toContain('€50 / month');
		expect(out).toContain('href="/products/p1"');
		expect(out).not.toContain('Free Data'); // limit=1
		expect(out).not.toContain('<obp-products');
	});

	it('supports self-closing tags and list layout, and renders Free for zero price', async () => {
		const out = await expandLiveTags('<obp-products layout="list" />', fetchers());
		expect(out).toContain('obp-products--list');
		expect(out).toContain('Free');
	});

	it('renders endpoints with verb classes and explorer links', async () => {
		const out = await expandLiveTags('<obp-endpoints collection="c1"></obp-endpoints>', fetchers());
		expect(out).toContain('obp-endpoint-verb--get');
		expect(out).toContain('/obp/v6.0.0/banks');
		expect(out).toContain('href="https://explorer/operationid/OBPv6.0.0-getBanks"');
	});

	it('neutralises unsafe URLs from the catalogue', async () => {
		const out = await expandLiveTags('<obp-banks></obp-banks>', fetchers());
		expect(out).toContain('href="#"');
		expect(out).toContain('src="https://x/logo.png"');
	});

	it('renders signup and stat', async () => {
		const out = await expandLiveTags('<obp-signup label="Join &amp; win"></obp-signup> <obp-stat kind="endpoint-count"></obp-stat>', fetchers());
		expect(out).toContain('class="obp-signup obp-signup--primary" href="/register"');
		expect(out).toContain('>812</span>');
	});

	it('shows a visible error in preview mode and nothing in hide mode', async () => {
		const failing = fetchers({ products: async () => { throw new Error('boom'); } });
		const shown = await expandLiveTags('<obp-products></obp-products>', failing);
		expect(shown).toContain('obp-block-error');
		expect(shown).toContain('boom');
		const hidden = await expandLiveTags('a<obp-products></obp-products>b', failing, { onError: 'hide' });
		expect(hidden).toBe('ab');
	});

	it('reports a missing required attribute', async () => {
		const out = await expandLiveTags('<obp-endpoints></obp-endpoints>', fetchers());
		expect(out).toContain('needs a collection attribute');
	});

	it('leaves unknown obp- tags and ordinary HTML untouched', async () => {
		const html = '<obp-unknown a="1"></obp-unknown><p>x</p>';
		expect(await expandLiveTags(html, fetchers())).toBe(html);
	});
});

describe('registry', () => {
	it('describes every tag and behaviour for Opey', () => {
		const text = describeLandingBlocksForOpey();
		for (const t of LIVE_TAGS) expect(text).toContain(`<${t.tag}>`);
		for (const b of BEHAVIOURS) expect(text).toContain(`- ${b.name} —`);
		expect(text.split('\n').length).toBeLessThan(80);
	});

	it('has an initialiser for every registered behaviour', () => {
		for (const b of BEHAVIOURS) expect(LANDING_BEHAVIOUR_NAMES).toContain(b.name);
	});
});

describe('helpers', () => {
	it('escapes html and filters urls', () => {
		expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
		expect(safeUrl('https://ok')).toBe('https://ok');
		expect(safeUrl('/relative')).toBe('/relative');
		expect(safeUrl('javascript:alert(1)')).toBe('#');
		expect(safeUrl('data:text/html,hi')).toBe('#');
	});
});
