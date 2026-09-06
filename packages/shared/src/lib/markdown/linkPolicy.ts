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
 * Link-host policy for user-generated content (chat messages).
 *
 * Untrusted authors can post URLs; readers are protected at render time by
 * refusing to make links clickable unless their host is on an allowlist
 * derived from the deployment's own configuration. The text itself is kept —
 * nothing is deleted from the message, the URL just stays inert text.
 *
 * The check parses the URL and compares hostnames (exact match or subdomain
 * of an allowed host). Never test with substring matching — e.g.
 * "https://openbankproject.com.evil.example" contains the OBP domain but must
 * not pass.
 */

// C0 controls except \t \n \r, DEL + C1 controls, and the Unicode bidi
// override/isolate/mark characters ("Trojan Source" family): none have a
// legitimate use in chat, and the bidi ones can visually reverse text to
// disguise what a URL or name says. Mirrors ChatContentPolicy in OBP-API,
// which strips these on input; applying it at render time too covers
// messages stored before that policy existed.
const DANGEROUS_CHARACTERS =
	// eslint-disable-next-line no-control-regex
	/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

export function stripDangerousCharacters(content: string): string {
	return content.replace(DANGEROUS_CHARACTERS, '');
}

/** Hostnames (lowercase) of the given config URLs — invalid/empty entries are skipped. */
export function collectLinkHosts(urls: Array<string | undefined | null>): string[] {
	const hosts = new Set<string>();
	for (const url of urls) {
		if (!url) continue;
		try {
			hosts.add(new URL(url).hostname.toLowerCase());
		} catch {
			// not a URL (e.g. a bare hostname from an allowlist env var) — accept as host
			const bare = url.trim().toLowerCase();
			if (/^[a-z0-9.-]+$/.test(bare) && bare.length > 0) {
				hosts.add(bare);
			}
		}
	}
	return [...hosts];
}

export function isAllowedLinkHref(href: string, allowedHosts: string[]): boolean {
	const trimmed = href.trim();
	if (trimmed === '') return true;

	// Site-relative links stay within this deployment
	if (/^[#?/]/.test(trimmed) && !trimmed.startsWith('//')) return true;

	if (/^mailto:/i.test(trimmed)) return true;

	// Absolute http(s) and protocol-relative URLs: judge by hostname
	let parseable = trimmed;
	if (trimmed.startsWith('//')) parseable = `https:${trimmed}`;
	if (!/^https?:\/\//i.test(parseable)) return false;

	let hostname: string;
	try {
		hostname = new URL(parseable).hostname.toLowerCase();
	} catch {
		return false;
	}
	if (allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
		return true;
	}
	// localhost, *.localhost, 127.0.0.1 and ::1 are the same place; if any
	// loopback form is allowed (dev deployments), all loopback forms pass.
	return isLoopback(hostname) && allowedHosts.some(isLoopback);
}

function isLoopback(hostname: string): boolean {
	return (
		hostname === 'localhost' ||
		hostname === '127.0.0.1' ||
		hostname === '[::1]' ||
		hostname === '::1' ||
		hostname.endsWith('.localhost')
	);
}

/**
 * Replace anchors whose href fails the host policy with a plain <span>
 * carrying the anchor's visible text. Expects sanitized HTML; runs in the
 * browser (uses DOM parsing).
 */
export function filterLinksByHost(html: string, allowedHosts: string[]): string {
	const template = document.createElement('template');
	template.innerHTML = html;
	for (const anchor of template.content.querySelectorAll('a[href]')) {
		const href = anchor.getAttribute('href') ?? '';
		if (!isAllowedLinkHref(href, allowedHosts)) {
			const span = document.createElement('span');
			span.className = 'blocked-link';
			span.textContent = anchor.textContent;
			anchor.replaceWith(span);
		}
	}
	return template.innerHTML;
}
