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

// The same redirect URL rules OBP-API applies when a Consumer's redirect URL or a Berlin Group TPP redirect
// header is written (code.api.util.RedirectUrlValidation). Data stored before those checks existed, and
// data from other sources, can still break them, so pages check again before they navigate or link.

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
// A reverse-domain app scheme, such as com.example.app or x-com.example.ios (RFC 8252).
const REVERSE_DOMAIN_SCHEME = /^[a-z][a-z0-9+-]*(\.[a-z0-9+-]+)+$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/**
 * This function returns why `entry` may not be used as a redirect target, or null when it may. Allowed:
 * https with a host; http only for localhost, 127.0.0.1 or [::1]; an app scheme in reverse-domain form.
 * Never a wildcard, user information, a fragment, a backslash or a control character.
 */
export function externalRedirectProblem(entry: string | null | undefined): string | null {
	if (!entry || typeof entry !== 'string') return 'it is empty';
	if (entry.includes('*')) return 'a wildcard is not allowed';
	if (entry.includes('\\') || CONTROL_CHARACTERS.test(entry)) return 'it contains a backslash or a control character';
	let url: URL;
	try {
		url = new URL(entry);
	} catch {
		return 'it is not a valid absolute URL';
	}
	if (url.username || url.password) return 'user information is not allowed';
	if (url.hash || entry.includes('#')) return 'a fragment is not allowed';
	const scheme = url.protocol.replace(/:$/, '').toLowerCase();
	if (scheme === 'https') return url.hostname ? null : 'an https URL must name a host';
	if (scheme === 'http') {
		return LOOPBACK_HOSTS.has(url.hostname.toLowerCase())
			? null
			: 'http is only allowed for localhost, 127.0.0.1 or [::1]';
	}
	return REVERSE_DOMAIN_SCHEME.test(scheme)
		? null
		: `the scheme '${scheme}' is not allowed`;
}

/** Whether `entry` may be used as a redirect target (see externalRedirectProblem). */
export function isSafeExternalRedirect(entry: string | null | undefined): entry is string {
	return externalRedirectProblem(entry) === null;
}

/** Splits a stored redirect URL value into its entries, the same way OBP-API and OBP-OIDC do. */
export function redirectUrlEntries(value: string | null | undefined): string[] {
	return (value ?? '').split(/[,\s]+/).map((entry) => entry.trim()).filter((entry) => entry.length > 0);
}

/** The first entry of a stored redirect URL value that may be used as a redirect target, or null. */
export function firstSafeExternalRedirect(value: string | null | undefined): string | null {
	return redirectUrlEntries(value).find((entry) => isSafeExternalRedirect(entry)) ?? null;
}

/**
 * Whether `url` may be shown as a clickable link that opens in the browser. Stricter than a redirect target:
 * only http or https with a host and no user information, so a stored `javascript:` or `data:` value is
 * shown as text instead of becoming a link.
 */
export function isSafeLinkUrl(url: string | null | undefined): url is string {
	if (!url || typeof url !== 'string' || CONTROL_CHARACTERS.test(url) || url.includes('\\')) return false;
	try {
		const parsed = new URL(url);
		return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !!parsed.hostname && !parsed.username && !parsed.password;
	} catch {
		return false;
	}
}

/**
 * The value to put in a link's href: `url` when isSafeLinkUrl allows it, otherwise undefined, which leaves
 * the anchor without an href so it shows the text but cannot be followed.
 */
export function safeLinkHref(url: string | null | undefined): string | undefined {
	return isSafeLinkUrl(url) ? url : undefined;
}
