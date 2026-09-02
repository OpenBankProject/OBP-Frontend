/**
 * Landing page blocks: the server-side expander.
 *
 * Replaces every live-data tag in a page (see registry.ts) with plain HTML, using
 * fetchers the host app supplies. All values from the catalogue are HTML-escaped,
 * so a product description can never inject markup into the page.
 *
 * The expander is framework-free and does no I/O of its own, which keeps it
 * testable and lets the Portal (render) and the API Manager (preview) share it.
 */

import { LIVE_TAGS } from './registry.js';

export interface LandingProduct {
	bank_id: string;
	api_product_code: string;
	name: string;
	description?: string;
	category?: string;
	price_monthly?: number;
	price_currency?: string;
}

export interface LandingEndpoint {
	operation_id: string;
	request_verb?: string;
	request_url?: string;
	summary?: string;
}

export interface LandingBank {
	id: string;
	full_name: string;
	logo?: string;
	website?: string;
}

export interface LandingFetchers {
	products(opts: { tag?: string; bank?: string; limit: number }): Promise<LandingProduct[]>;
	endpoints(opts: { collection: string; limit: number }): Promise<LandingEndpoint[]>;
	banks(opts: { limit: number }): Promise<LandingBank[]>;
	stat(kind: string): Promise<number | string>;
	links: {
		/** Where a product card links to, e.g. `/products/${code}`. */
		product(product: LandingProduct): string;
		/** Where an endpoint links to (API Explorer), or undefined for no link. */
		endpoint?(endpoint: LandingEndpoint): string | undefined;
		/** The sign-up call-to-action target. */
		signup: string;
	};
}

export interface ExpandOptions {
	/** "show" renders a visible error block when a fetcher fails (preview); "hide" renders nothing (production). */
	onError?: 'show' | 'hide';
}

export function escapeHtml(value: unknown): string {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/** Only http(s) URLs survive into href/src; anything else becomes "#". */
export function safeUrl(value: unknown): string {
	const url = String(value ?? '').trim();
	if (/^https?:\/\//i.test(url) || url.startsWith('/')) return escapeHtml(url);
	return '#';
}

function parseAttributes(raw: string): Record<string, string> {
	const attrs: Record<string, string> = {};
	const re = /([a-zA-Z_][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(raw)) !== null) {
		attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
	}
	return attrs;
}

function limitOf(attrs: Record<string, string>, fallback: number): number {
	const n = parseInt(attrs.limit ?? '', 10);
	return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : fallback;
}

function formatPrice(p: LandingProduct): string {
	if (p.price_monthly === undefined || p.price_monthly === null) return '';
	if (p.price_monthly === 0) return 'Free';
	try {
		return (
			new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: p.price_currency || 'USD',
				minimumFractionDigits: 0,
				maximumFractionDigits: 2
			}).format(p.price_monthly) + ' / month'
		);
	} catch {
		return `${p.price_monthly} ${p.price_currency ?? ''} / month`;
	}
}

// ---- Renderers: one per live tag. All output is escaped. --------------------

async function renderProducts(attrs: Record<string, string>, f: LandingFetchers): Promise<string> {
	const layout = attrs.layout === 'list' ? 'list' : 'cards';
	const products = await f.products({ tag: attrs.tag || undefined, bank: attrs.bank || undefined, limit: limitOf(attrs, 6) });
	if (products.length === 0) return `<div class="obp-products obp-products--${layout} obp-products--empty"></div>`;
	const items = products
		.map(
			(p) => `<article class="obp-product-card">
${p.category ? `<div class="obp-product-category">${escapeHtml(p.category)}</div>` : ''}
<h3 class="obp-product-name">${escapeHtml(p.name || p.api_product_code)}</h3>
${p.description ? `<p class="obp-product-description">${escapeHtml(p.description)}</p>` : ''}
${formatPrice(p) ? `<div class="obp-product-price">${escapeHtml(formatPrice(p))}</div>` : ''}
<a class="obp-product-link" href="${safeUrl(f.links.product(p))}">View product</a>
</article>`
		)
		.join('\n');
	return `<div class="obp-products obp-products--${layout}">\n${items}\n</div>`;
}

async function renderEndpoints(attrs: Record<string, string>, f: LandingFetchers): Promise<string> {
	const collection = (attrs.collection ?? '').trim();
	if (!collection) throw new Error('<obp-endpoints> needs a collection attribute');
	const endpoints = await f.endpoints({ collection, limit: limitOf(attrs, 8) });
	if (endpoints.length === 0) return `<ul class="obp-endpoints obp-endpoints--empty"></ul>`;
	const items = endpoints
		.map((e) => {
			const verb = (e.request_verb || 'GET').toUpperCase();
			const href = f.links.endpoint?.(e);
			const inner = `<span class="obp-endpoint-verb obp-endpoint-verb--${escapeHtml(verb.toLowerCase())}">${escapeHtml(verb)}</span>
<code class="obp-endpoint-url">${escapeHtml(e.request_url || e.operation_id)}</code>
${e.summary ? `<span class="obp-endpoint-summary">${escapeHtml(e.summary)}</span>` : ''}`;
			return `<li class="obp-endpoint">${href ? `<a href="${safeUrl(href)}">${inner}</a>` : inner}</li>`;
		})
		.join('\n');
	return `<ul class="obp-endpoints">\n${items}\n</ul>`;
}

async function renderBanks(attrs: Record<string, string>, f: LandingFetchers): Promise<string> {
	const banks = await f.banks({ limit: limitOf(attrs, 12) });
	if (banks.length === 0) return `<div class="obp-banks obp-banks--empty"></div>`;
	const items = banks
		.map((b) => {
			const inner = `${b.logo ? `<img class="obp-bank-logo" src="${safeUrl(b.logo)}" alt="">` : ''}<span class="obp-bank-name">${escapeHtml(b.full_name || b.id)}</span>`;
			return `<div class="obp-bank">${b.website ? `<a href="${safeUrl(b.website)}" rel="noopener">${inner}</a>` : inner}</div>`;
		})
		.join('\n');
	return `<div class="obp-banks">\n${items}\n</div>`;
}

async function renderSignup(attrs: Record<string, string>, f: LandingFetchers): Promise<string> {
	const variant = attrs.variant === 'secondary' ? 'secondary' : 'primary';
	const label = attrs.label || 'Get your API key';
	return `<a class="obp-signup obp-signup--${variant}" href="${safeUrl(f.links.signup)}">${escapeHtml(label)}</a>`;
}

async function renderStat(attrs: Record<string, string>, f: LandingFetchers): Promise<string> {
	const kind = (attrs.kind ?? '').trim();
	if (!kind) throw new Error('<obp-stat> needs a kind attribute');
	const value = await f.stat(kind);
	return `<span class="obp-stat" data-kind="${escapeHtml(kind)}">${escapeHtml(value)}</span>`;
}

const RENDERERS: Record<string, (attrs: Record<string, string>, f: LandingFetchers) => Promise<string>> = {
	'obp-products': renderProducts,
	'obp-endpoints': renderEndpoints,
	'obp-banks': renderBanks,
	'obp-signup': renderSignup,
	'obp-stat': renderStat
};

// Every registered tag must have a renderer; fail at import time if not.
for (const t of LIVE_TAGS) {
	if (!RENDERERS[t.tag]) throw new Error(`No renderer for live tag <${t.tag}>`);
}

/** Matches `<obp-xxx attrs>` optionally followed by whitespace and `</obp-xxx>`, or self-closing. */
const TAG_PATTERN = /<(obp-[a-z]+)\b([^>]*?)\s*\/?>(?:\s*<\/\1\s*>)?/gi;

/**
 * Expand all live-data tags in `html`. Unknown `obp-*` tags are left untouched
 * (the sanitiser removes them later). Fetchers run concurrently.
 */
export async function expandLiveTags(html: string, fetchers: LandingFetchers, options: ExpandOptions = {}): Promise<string> {
	const onError = options.onError ?? 'show';
	const matches = [...html.matchAll(TAG_PATTERN)].filter((m) => RENDERERS[m[1].toLowerCase()]);
	if (matches.length === 0) return html;

	const replacements = await Promise.all(
		matches.map(async (m) => {
			const tag = m[1].toLowerCase();
			const attrs = parseAttributes(m[2] ?? '');
			try {
				return await RENDERERS[tag](attrs, fetchers);
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				return onError === 'show'
					? `<div class="obp-block-error" role="alert">${escapeHtml(`<${tag}> could not be rendered: ${message}`)}</div>`
					: '';
			}
		})
	);

	let out = '';
	let cursor = 0;
	matches.forEach((m, i) => {
		const start = m.index ?? 0;
		out += html.slice(cursor, start) + replacements[i];
		cursor = start + m[0].length;
	});
	out += html.slice(cursor);
	return out;
}
