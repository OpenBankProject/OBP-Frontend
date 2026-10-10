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

// A base that can never be a real site, so the origin check below can only pass for a path on this site.
const INTERNAL_BASE = 'http://internal.invalid';

// Control characters (tab, newline, ...) are removed by browsers when they read a Location header,
// so `/\t/evil.com` arrives as `//evil.com`. Backslashes are read as forward slashes.
const UNSAFE_CHARACTERS = /[\u0000-\u001f\u007f\\]/;

/**
 * This function decides whether a value taken from a request (a `redirect_to` or `return_to` parameter, or a
 * cookie that held one) may be used as a redirect target, and returns the path to redirect to.
 *
 * Only a path on this site is allowed. A value is refused when it contains a control character or a
 * backslash, does not start with a single `/`, or resolves to another origin. The value is then rebuilt
 * from the parsed URL, and refused again if the rebuilt path starts with `//`: dot segments such as
 * `/.//evil.com` or `/a/..//evil.com` normalise to `//evil.com`, which a browser reads as another host.
 *
 * Returns the normalised path, query and fragment, or null when the value is not safe. Always redirect to
 * the returned value, never to the original.
 */
export function safeInternalPath(raw: string | null | undefined): string | null {
	if (!raw || typeof raw !== 'string') return null;
	if (UNSAFE_CHARACTERS.test(raw)) return null;
	if (!raw.startsWith('/') || raw.startsWith('//')) return null;
	let url: URL;
	try {
		url = new URL(raw, INTERNAL_BASE);
	} catch {
		return null;
	}
	if (url.origin !== INTERNAL_BASE) return null;
	const path = url.pathname + url.search + url.hash;
	if (path.startsWith('//') || UNSAFE_CHARACTERS.test(path)) return null;
	return path;
}

/**
 * This returns the page to reload after a session is destroyed. The request path is not trusted as it is:
 * a request for `//evil.example` has that as its pathname, and a Location header of `//evil.example`
 * sends the browser to another host. Anything that is not a path on this site reloads the home page.
 */
export function reloadPathAfterSessionEnds(url: URL): string {
	return safeInternalPath(url.pathname + url.search) ?? '/';
}
