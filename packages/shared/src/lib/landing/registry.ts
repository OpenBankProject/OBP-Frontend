/**
 * Landing page blocks: the registry.
 *
 * A landing page is free HTML and CSS written by a person or by Opey. The only
 * parts plain HTML cannot do are (1) fetch live catalogue data and (2) react to
 * clicks. Those two are covered here, and nothing else is: the layout, colours
 * and typography stay free.
 *
 *   - Live-data TAGS are custom elements (`<obp-products tag="featured">`) that the
 *     server expands into plain HTML before the page is sent (see expand.ts).
 *   - BEHAVIOURS are `data-behaviour="…"` attributes that a small trusted script
 *     wires up on load (see behaviours.ts). Authors never write script.
 *
 * This registry is the single source of truth: the expander, the behaviours
 * script, the sanitiser allowlist and Opey's page context are all derived from it.
 */

export interface BlockAttribute {
	name: string;
	description: string;
	required?: boolean;
	default?: string;
}

export interface LiveTagDefinition {
	/** Element name, e.g. `obp-products`. */
	tag: string;
	description: string;
	attributes: BlockAttribute[];
	/** Class names the expanded markup carries, so a page's CSS can style it. */
	classes: string[];
	example: string;
}

export interface BehaviourDefinition {
	/** Value of `data-behaviour`. */
	name: string;
	description: string;
	attributes: BlockAttribute[];
	/** Class names the behaviour toggles, so a page's CSS can react. */
	classes: string[];
	example: string;
}

export const LIVE_TAGS: LiveTagDefinition[] = [
	{
		tag: 'obp-products',
		description: 'API products from the live catalogue, as cards or a list.',
		attributes: [
			{ name: 'tag', description: 'Only products carrying this catalogue tag (e.g. featured, hackathon).' },
			{ name: 'bank', description: 'Only products of this bank id.' },
			{ name: 'limit', description: 'Maximum number of products.', default: '6' },
			{ name: 'layout', description: '"cards" or "list".', default: 'cards' }
		],
		classes: [
			'obp-products',
			'obp-products--cards',
			'obp-products--list',
			'obp-product-card',
			'obp-product-category',
			'obp-product-name',
			'obp-product-description',
			'obp-product-price',
			'obp-product-link'
		],
		example: '<obp-products tag="featured" limit="3" layout="cards"></obp-products>'
	},
	{
		tag: 'obp-endpoints',
		description: 'The endpoints of an API collection, with verb, path and summary, linking to the API Explorer.',
		attributes: [
			{ name: 'collection', description: 'API collection id.', required: true },
			{ name: 'limit', description: 'Maximum number of endpoints.', default: '8' }
		],
		classes: [
			'obp-endpoints',
			'obp-endpoint',
			'obp-endpoint-verb',
			'obp-endpoint-verb--get',
			'obp-endpoint-verb--post',
			'obp-endpoint-verb--put',
			'obp-endpoint-verb--delete',
			'obp-endpoint-url',
			'obp-endpoint-summary'
		],
		example: '<obp-endpoints collection="API_COLLECTION_ID" limit="6"></obp-endpoints>'
	},
	{
		tag: 'obp-banks',
		description: 'The banks on this instance, with logo and name.',
		attributes: [{ name: 'limit', description: 'Maximum number of banks.', default: '12' }],
		classes: ['obp-banks', 'obp-bank', 'obp-bank-logo', 'obp-bank-name'],
		example: '<obp-banks limit="6"></obp-banks>'
	},
	{
		tag: 'obp-signup',
		description: 'A call-to-action link to the Portal sign-up (or login) page.',
		attributes: [
			{ name: 'label', description: 'Button text.', default: 'Get your API key' },
			{ name: 'variant', description: '"primary" or "secondary".', default: 'primary' }
		],
		classes: ['obp-signup', 'obp-signup--primary', 'obp-signup--secondary'],
		example: '<obp-signup label="Register for the hackathon"></obp-signup>'
	},
	{
		tag: 'obp-stat',
		description: 'A single live number from the catalogue.',
		attributes: [
			{
				name: 'kind',
				description: '"endpoint-count", "product-count" or "bank-count".',
				required: true
			}
		],
		classes: ['obp-stat'],
		example: '<obp-stat kind="endpoint-count"></obp-stat>'
	}
];

export const BEHAVIOURS: BehaviourDefinition[] = [
	{
		name: 'countdown',
		description: 'Counts down to a date; renders days/hours/minutes/seconds parts inside the element.',
		attributes: [
			{ name: 'data-until', description: 'ISO 8601 date-time, e.g. 2026-10-12T09:00:00Z.', required: true },
			{ name: 'data-done', description: 'Text shown once the date has passed.', default: 'Started' }
		],
		classes: ['obp-countdown-part', 'obp-countdown-value', 'obp-countdown-label', 'is-done'],
		example: '<div data-behaviour="countdown" data-until="2026-10-12T09:00:00Z" data-done="We are live"></div>'
	},
	{
		name: 'tabs',
		description:
			'Tabbed panels. Buttons carry data-tab="KEY", panels carry data-panel="KEY"; the first tab starts active.',
		attributes: [],
		classes: ['is-active'],
		example:
			'<section data-behaviour="tabs"><nav><button data-tab="day1">Day 1</button><button data-tab="day2">Day 2</button></nav><div data-panel="day1">…</div><div data-panel="day2">…</div></section>'
	},
	{
		name: 'copy',
		description: 'Copies the text of a target element to the clipboard.',
		attributes: [
			{ name: 'data-target', description: 'CSS selector of the element whose text is copied.', required: true },
			{ name: 'data-copied-label', description: 'Button text after copying.', default: 'Copied' }
		],
		classes: ['is-copied'],
		example: '<pre id="curl">curl https://…/obp/v6.0.0/banks</pre><button data-behaviour="copy" data-target="#curl">Copy</button>'
	},
	{
		name: 'reveal',
		description: 'Adds the is-visible class when the element scrolls into view, for entrance animations in CSS.',
		attributes: [],
		classes: ['is-visible'],
		example: '<section data-behaviour="reveal">…</section>'
	},
	{
		name: 'carousel',
		description:
			'Horizontal scroll-snap rail with previous/next buttons. Children: one scrolling element with data-track, buttons with data-prev and data-next.',
		attributes: [],
		classes: [],
		example:
			'<div data-behaviour="carousel"><button data-prev>‹</button><div data-track>…cards…</div><button data-next>›</button></div>'
	}
];

/**
 * Opey's page context for landing pages: everything the model needs to use the
 * blocks, in ~40 lines. Regenerated from the registry so it never drifts.
 */
export function describeLandingBlocksForOpey(): string {
	const lines: string[] = [
		'Landing page blocks. The page is free HTML + CSS (no <script>: scripts are removed). Two kinds of blocks exist:',
		'',
		'LIVE-DATA TAGS (custom elements the server expands into HTML at render time; style them via the listed classes):'
	];
	for (const t of LIVE_TAGS) {
		lines.push(`- <${t.tag}> — ${t.description}`);
		for (const a of t.attributes) {
			lines.push(
				`    ${a.name}${a.required ? ' (required)' : ''}: ${a.description}${a.default ? ` Default ${a.default}.` : ''}`
			);
		}
		lines.push(`    classes: ${t.classes.join(', ')}`);
		lines.push(`    example: ${t.example}`);
	}
	lines.push('', 'BEHAVIOURS (data-behaviour="NAME" on any element; a trusted page script wires them up):');
	for (const b of BEHAVIOURS) {
		lines.push(`- ${b.name} — ${b.description}`);
		for (const a of b.attributes) {
			lines.push(
				`    ${a.name}${a.required ? ' (required)' : ''}: ${a.description}${a.default ? ` Default ${a.default}.` : ''}`
			);
		}
		if (b.classes.length) lines.push(`    classes: ${b.classes.join(', ')}`);
		lines.push(`    example: ${b.example}`);
	}
	lines.push(
		'',
		'Use native <details>/<summary> for accordions. Images: <img src="https://…"> from the allowed hosts only.',
		'Keep CSS inside one <style> block and scope selectors under a single wrapper class so it cannot leak.'
	);
	return lines.join('\n');
}
