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
import type { Cookies } from '@sveltejs/kit';
import { safeInternalPath } from '$shared/utils/redirect';

/**
 * Where a visitor goes after logging in. A protected page sends them to
 * `/login?return_to=<path>`; the login page keeps the path in a short-lived cookie that
 * survives the OAuth round trip, and the callback sends them there instead of to `/`.
 * Only paths on this site are accepted, so the parameter cannot become an open redirect.
 */
export const RETURN_TO_PARAM = 'return_to';
const COOKIE = 'obp_return_to';

/**
 * The path and query of `raw` if it is a path on this site worth returning to, else null. Whether it is on
 * this site at all is decided by the shared safeInternalPath; the home, login and logout pages are not
 * worth returning to.
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
	const safe = safeInternalPath(raw);
	if (!safe) return null;
	const url = new URL(safe, 'http://internal.invalid');
	if (url.pathname === '/' || url.pathname.startsWith('/login') || url.pathname.startsWith('/logout')) return null;
	return url.pathname + url.search;
}

/** The login page's URL for a visitor who wanted `path`. */
export function loginUrlReturningTo(path: string): string {
	const safe = safeReturnPath(path);
	return safe ? `/login?${RETURN_TO_PARAM}=${encodeURIComponent(safe)}` : '/login';
}

export function rememberReturnTo(cookies: Cookies, raw: string | null): void {
	const safe = safeReturnPath(raw);
	if (!safe) return;
	cookies.set(COOKIE, safe, { httpOnly: true, maxAge: 60 * 10, secure: import.meta.env.PROD, path: '/', sameSite: 'lax' });
}

/** The remembered path, once: the cookie is removed as it is read. */
export function takeReturnTo(cookies: Cookies): string | null {
	const safe = safeReturnPath(cookies.get(COOKIE));
	cookies.delete(COOKIE, { path: '/' });
	return safe;
}
