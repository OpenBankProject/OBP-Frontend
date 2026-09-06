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
 * Landing page blocks: preview-grade stripping of active content.
 *
 * Removes everything that could execute or navigate on its own: script, iframe,
 * object, embed, link, meta, base and svg/math foreign content, inline event
 * handlers, and javascript:/data: URLs. Author pages are HTML + CSS only, so
 * nothing legitimate is lost.
 *
 * This is deliberately simple and regex-based, which is fine for previewing a
 * page in an admin tool. Publishing to the Portal needs a real HTML sanitiser
 * (DOM-based, allowlist) in front of it, not instead of it.
 */

const REMOVE_ELEMENTS = ['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'link', 'meta', 'base', 'svg', 'math', 'template', 'noscript'];

export function stripActiveContent(html: string): string {
	let out = html ?? '';
	// Elements with content: remove the whole element. Case-insensitive, dotall.
	for (const tag of REMOVE_ELEMENTS) {
		out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
		// Void or unclosed forms of the same tags.
		out = out.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
	}
	// Inline event handlers: onclick="…", onload='…', onerror=x
	out = out.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
	// javascript:, vbscript: and data: URLs in href/src/action/formaction/xlink:href
	out = out.replace(
		/(\s(?:href|src|action|formaction|xlink:href|poster|background)\s*=\s*)(?:"\s*(?:javascript|vbscript|data):[^"]*"|'\s*(?:javascript|vbscript|data):[^']*'|\s*(?:javascript|vbscript|data):[^\s>]+)/gi,
		'$1"#"'
	);
	// CSS that pulls in remote resources or runs expressions.
	out = out.replace(/@import\s+[^;]+;?/gi, '');
	out = out.replace(/expression\s*\(/gi, 'blocked(');
	out = out.replace(/behavior\s*:/gi, 'blocked:');
	return out;
}
