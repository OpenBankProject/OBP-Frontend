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
 * Allowlist HTML sanitisers for untrusted HTML rendered inline with {@html}.
 *
 * DOMPurify (DOM-based, allowlist) removes every script, handler, frame and unsafe URL.
 * Never use a regex blocklist instead: entity-encoded URLs (`java&#x73;cript:`) and
 * `/`-separated handlers slip through one.
 *
 * sanitizePageHtml: a published Page (HTML + CSS written by a person or by Opey). The
 * live-data custom tags and behaviour data attributes from the landing registry are
 * allowed; `stripActiveContent` runs afterwards for the CSS rules DOMPurify does not
 * cover (@import, expression()). Expand the live tags AFTER sanitising: the expander
 * escapes catalogue data.
 *
 * sanitizeContentHtml: ordinary content HTML from the API (e.g. a resource doc
 * description). No style, no forms, no custom elements.
 */
/// <reference path="./jsdom.d.ts" />
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { LIVE_TAGS, BEHAVIOURS } from '../../landing/registry.js';
import { stripActiveContent } from '../../landing/strip.js';

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

const ACTIVE_TAGS = ['script', 'iframe', 'frame', 'object', 'embed', 'link', 'meta', 'base', 'form', 'input', 'textarea', 'select', 'svg', 'math'];
const ACTIVE_ATTRS = ['srcdoc', 'formaction', 'xlink:href'];
// URL attributes must match this: no protocol-relative (//host) or other schemes. Checked in
// a hook rather than ALLOWED_URI_REGEXP, which DOMPurify also applies to non-URL attributes
// (target, width, colspan) and would strip them.
const SAFE_URI = /^(?:https?:|mailto:|tel:|\/(?!\/)|#|\.)/i;
const URL_ATTRS = ['href', 'src', 'action', 'poster', 'cite', 'background'];

// jsdom is heavy: build the DOMPurify instance on first use, not on import.
let purifier: ReturnType<typeof createDOMPurify> | null = null;

function getPurifier() {
	if (!purifier) {
		purifier = createDOMPurify(new JSDOM('').window);
		purifier.addHook('afterSanitizeAttributes', (node) => {
			for (const attr of URL_ATTRS) {
				const value = node.getAttribute(attr);
				if (value !== null && !SAFE_URI.test(value.trim())) node.removeAttribute(attr);
			}
			// target=_blank links must not hand the opener to the destination.
			if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
				node.setAttribute('rel', 'noopener noreferrer');
			}
		});
	}
	return purifier;
}

export function sanitizePageHtml(source: string): string {
	const clean = getPurifier().sanitize(source ?? '', {
		// DOMPurify's default allowlist covers content HTML; add what a Page needs on top.
		ADD_TAGS: ['style', 'details', 'summary', ...LIVE_TAG_NAMES],
		ADD_ATTR: [...LIVE_TAG_ATTRS, ...BEHAVIOUR_ATTRS, 'target'],
		FORBID_TAGS: ACTIVE_TAGS,
		FORBID_ATTR: ACTIVE_ATTRS,
		FORCE_BODY: true,
		CUSTOM_ELEMENT_HANDLING: {
			tagNameCheck: (tagName) => LIVE_TAG_NAMES.includes(tagName),
			attributeNameCheck: (attr) => LIVE_TAG_ATTRS.includes(attr),
			allowCustomizedBuiltInElements: false
		}
	});
	return stripActiveContent(String(clean));
}

export function sanitizeContentHtml(source: string): string {
	return String(
		getPurifier().sanitize(source ?? '', {
			ADD_ATTR: ['target'],
			FORBID_TAGS: [...ACTIVE_TAGS, 'style'],
			FORBID_ATTR: [...ACTIVE_ATTRS, 'style']
		})
	);
}
