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
 * Why a login failed. Only the code travels in the URL (`/login?error=<code>`); the login page shows
 * the translated text for it, so no text from the provider or the URL is ever rendered.
 */
export const LOGIN_ERRORS = [
	'access_denied',
	'login_failed',
	'session_expired',
	'invalid_state',
	'provider_unavailable',
	'user_lookup_failed'
] as const;
export type LoginError = (typeof LOGIN_ERRORS)[number];

export function loginErrorUrl(code: LoginError): string {
	return `/login?error=${code}`;
}

export function parseLoginError(raw: string | null): LoginError | null {
	return (LOGIN_ERRORS as readonly string[]).includes(raw ?? '') ? (raw as LoginError) : null;
}
