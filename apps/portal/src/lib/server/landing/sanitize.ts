/**
 * Sanitiser for published Page sources before the Portal renders them inline.
 *
 * A Page is HTML + CSS written by a person or by Opey: never trusted. DOMPurify (DOM-based,
 * allowlist) removes every script, handler, frame and unsafe URL; the live-data custom tags
 * and the behaviour data attributes from the landing registry are explicitly allowed.
 * `stripActiveContent` runs afterwards for the CSS rules DOMPurify does not cover (@import,
 * expression()). Expand the live tags AFTER sanitising: the expander escapes catalogue data.
 */
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { LIVE_TAGS, BEHAVIOURS, stripActiveContent } from '@obp/shared/landing';

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const LIVE_TAG_NAMES = LIVE_TAGS.map((t) => t.tag);
const LIVE_TAG_ATTRS = [...new Set(LIVE_TAGS.flatMap((t) => t.attributes.map((a) => a.name)))];
const BEHAVIOUR_ATTRS = [
	'data-behaviour',
	...new Set(BEHAVIOURS.flatMap((b) => b.attributes.map((a) => a.name))),
	'data-tab',
	'data-panel',
	'data-track',
	'data-prev',
	'data-next'
];

// target=_blank links must not hand the opener to the destination.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
	if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
		node.setAttribute('rel', 'noopener noreferrer');
	}
});

export function sanitizePageHtml(source: string): string {
	const clean = DOMPurify.sanitize(source ?? '', {
		// DOMPurify's default allowlist covers content HTML; add what a Page needs on top.
		ADD_TAGS: ['style', 'details', 'summary', ...LIVE_TAG_NAMES],
		ADD_ATTR: [...LIVE_TAG_ATTRS, ...BEHAVIOUR_ATTRS, 'target'],
		FORBID_TAGS: ['script', 'iframe', 'frame', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'textarea', 'select', 'svg', 'math'],
		FORBID_ATTR: ['srcdoc', 'formaction', 'xlink:href'],
		ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/(?!\/)|#|\.)/i,
		FORCE_BODY: true,
		CUSTOM_ELEMENT_HANDLING: {
			tagNameCheck: (tagName) => LIVE_TAG_NAMES.includes(tagName),
			attributeNameCheck: (attr) => LIVE_TAG_ATTRS.includes(attr),
			allowCustomizedBuiltInElements: false
		}
	});
	return stripActiveContent(String(clean));
}
