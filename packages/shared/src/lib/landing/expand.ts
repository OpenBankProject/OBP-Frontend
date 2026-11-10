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
/**
 * Landing page blocks: the server-side expander.
 *
 * Replaces every live-data tag in a page (see registry.ts) with plain HTML, using
 * fetchers the host app supplies. All values from the catalogue are HTML-escaped,
 * so a product description can never inject markup into the page. The one exception
 * is a glossary item's body, which is HTML by nature: the fetcher must hand it over
 * already sanitised (the server fetchers run it through the allowlist sanitiser).
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

/** An open call for applications, on a site that runs programmes (Cohort). */
export interface LandingCall {
	title: string;
	description?: string;
	/** The name of the programme it is for. */
	programme?: string;
	/** YYYY-MM-DD, or empty. */
	opens_at?: string;
	closes_at?: string;
	/** The call's page on the site. */
	href: string;
}

/** A programme, on a site that runs programmes (Cohort). */
export interface LandingProgramme {
	name: string;
	/** Plain text; lines starting with "- " are shown as a list. */
	description?: string;
	starts_on?: string;
	ends_on?: string;
}

export interface LandingGlossaryEntry {
	title: string;
	/** The rendered body. MUST already be sanitised: it is inserted as is. */
	sanitisedHtml: string;
	/** Plain text, escaped on output. */
	excerpt: string;
}

export interface LandingFetchers {
	products(opts: { tag?: string; bank?: string; limit: number }): Promise<LandingProduct[]>;
	endpoints(opts: { collection: string; limit: number }): Promise<LandingEndpoint[]>;
	banks(opts: { limit: number }): Promise<LandingBank[]>;
	stat(kind: string): Promise<number | string>;
	/** One glossary item, or undefined when the glossary has no such title. */
	glossary(title: string): Promise<LandingGlossaryEntry | undefined>;
	/** The open calls, on a site that runs programmes; absent elsewhere. */
	calls?(opts: { programme?: string; limit: number }): Promise<LandingCall[]>;
	/** The programmes, on a site that runs programmes; absent elsewhere. */
	programmes?(opts: { limit: number }): Promise<LandingProgramme[]>;
	links: {
		/** Where a product card links to, e.g. `/products/${code}`. */
		product(product: LandingProduct): string;
		/** Where an endpoint links to (API Explorer), or undefined for no link. */
		endpoint?(endpoint: LandingEndpoint): string | undefined;
		/** The sign-up call-to-action target. */
		signup: string;
		/** Where a glossary item links to. */
		glossary(title: string): string;
	};
}

export interface ExpandOptions {
	/** "show" renders a visible error block when a fetcher fails (preview); "hide" renders nothing (production). */
	onError?: 'show' | 'hide';
}

/**
 * A tag only some sites can fill, used on a site that can't, e.g. <obp-calls> (Cohort's open calls) in the App Studio
 * preview. A preview shows a note saying where it is filled in, not an error.
 */
class NotOnThisSite extends Error {
	constructor(public what: string) {
		super(`this site has no ${what}`);
	}
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

// ---- Renderers: one per live tag. All output is escaped, except a glossary body (sanitised by the fetcher).

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

async function renderGlossary(attrs: Record<string, string>, f: LandingFetchers): Promise<string> {
	const title = (attrs.title ?? '').trim();
	if (!title) throw new Error('<obp-glossary> needs a title attribute');
	const mode = attrs.mode === 'summary' ? 'summary' : 'full';
	const entry = await f.glossary(title);
	if (!entry) throw new Error(`the glossary has no item "${title}"`);
	const body =
		mode === 'full'
			? `<div class="obp-glossary-body">${entry.sanitisedHtml}</div>`
			: `<p class="obp-glossary-excerpt">${escapeHtml(entry.excerpt)}</p>`;
	return `<section class="obp-glossary obp-glossary--${mode}">
<h3 class="obp-glossary-title">${escapeHtml(entry.title)}</h3>
${body}
<a class="obp-glossary-link" href="${safeUrl(f.links.glossary(entry.title))}">View in the glossary</a>
</section>`;
}

/** A date, isolated so a right-to-left page does not reorder its digits. Escaped. */
const date = (d: string | undefined) => `<bdi>${escapeHtml(d)}</bdi>`;

/** Plain text as paragraphs, with runs of "- " lines as a list. Escaped. */
function textBlocks(text: string, className: string): string {
	const out: string[] = [];
	let items: string[] = [];
	const flush = () => {
		if (items.length) out.push(`<ul class="${className}-list">${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`);
		items = [];
	};
	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		const item = /^[-•*]\s+(.*)$/.exec(line);
		if (item) items.push(item[1]);
		else {
			flush();
			if (line) out.push(`<p class="${className}">${escapeHtml(line)}</p>`);
		}
	}
	flush();
	return out.join('\n');
}

async function renderCalls(attrs: Record<string, string>, f: LandingFetchers): Promise<string> {
	if (!f.calls) throw new NotOnThisSite('calls for applications');
	const calls = await f.calls({ programme: attrs.programme || undefined, limit: limitOf(attrs, 6) });
	if (calls.length === 0) {
		return `<div class="obp-calls obp-calls--empty">${attrs.empty ? `<p class="obp-calls-empty">${escapeHtml(attrs.empty)}</p>` : ''}</div>`;
	}
	const opens = attrs['opens-label'] || 'Opens';
	const closes = attrs['closes-label'] || 'Closes';
	const linkLabel = attrs['link-label'] || 'View call';
	const items = calls
		.map((c) => {
			const dates = [c.opens_at ? `${escapeHtml(opens)} ${date(c.opens_at)}` : '', c.closes_at ? `${escapeHtml(closes)} ${date(c.closes_at)}` : '']
				.filter(Boolean)
				.join(' · ');
			return `<article class="obp-call-card">
${c.programme ? `<div class="obp-call-programme" dir="auto">${escapeHtml(c.programme)}</div>` : ''}
<h3 class="obp-call-title" dir="auto"><a href="${safeUrl(c.href)}">${escapeHtml(c.title)}</a></h3>
${c.description ? `<p class="obp-call-description" dir="auto">${escapeHtml(c.description)}</p>` : ''}
${dates ? `<div class="obp-call-dates">${dates}</div>` : ''}
<a class="obp-call-link" href="${safeUrl(c.href)}">${escapeHtml(linkLabel)}</a>
</article>`;
		})
		.join('\n');
	return `<div class="obp-calls">\n${items}\n</div>`;
}

async function renderProgrammes(attrs: Record<string, string>, f: LandingFetchers): Promise<string> {
	if (!f.programmes) throw new NotOnThisSite('programmes');
	const programmes = await f.programmes({ limit: limitOf(attrs, 6) });
	if (programmes.length === 0) return `<div class="obp-programmes obp-programmes--empty"></div>`;
	const items = programmes
		.map((p, i) => {
			const dates = [p.starts_on, p.ends_on].filter(Boolean).map((d) => date(d)).join(' – ');
			return `<article class="obp-programme-card">
<div class="obp-programme-number">${i + 1}</div>
<h3 class="obp-programme-name" dir="auto">${escapeHtml(p.name)}</h3>
${p.description ? `<div class="obp-programme-description" dir="auto">${textBlocks(p.description, 'obp-programme-text')}</div>` : ''}
${dates ? `<div class="obp-programme-dates">${dates}</div>` : ''}
</article>`;
		})
		.join('\n');
	return `<div class="obp-programmes">\n${items}\n</div>`;
}

const RENDERERS: Record<string, (attrs: Record<string, string>, f: LandingFetchers) => Promise<string>> = {
	'obp-products': renderProducts,
	'obp-endpoints': renderEndpoints,
	'obp-banks': renderBanks,
	'obp-signup': renderSignup,
	'obp-stat': renderStat,
	'obp-glossary': renderGlossary,
	'obp-calls': renderCalls,
	'obp-programmes': renderProgrammes
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
				if (e instanceof NotOnThisSite)
					return onError === 'show'
						? `<div class="obp-block-note">${escapeHtml(`<${tag}>: the ${e.what} are shown here on a site that runs programmes, such as Cohort.`)}</div>`
						: '';
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
