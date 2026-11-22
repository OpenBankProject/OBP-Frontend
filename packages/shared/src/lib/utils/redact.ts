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
const SECRET_BODY_FIELDS = ['refresh_token', 'code', 'client_secret', 'password', 'access_token', 'id_token'];

// Renders a URL-encoded OAuth request body for logging with secret fields redacted,
// since these bodies carry refresh tokens / auth codes / client secrets verbatim.
export function redactUrlEncodedBody(body: URLSearchParams): string {
	const redacted = new URLSearchParams(body);
	for (const field of SECRET_BODY_FIELDS) {
		if (redacted.has(field)) {
			redacted.set(field, '[redacted]');
		}
	}
	return redacted.toString();
}

// A field name that holds a secret: any password (password, new_password, ...), secret (client_secret, consumer_secret, ...), token (access_token, refresh_token, ...) or key (consumer_key, api_key, ...), the client_id (which is the Consumer key), and a few short names used for one-time codes.
const SECRET_KEY_PATTERN = /password|secret|token|key$|^client_id$|^pin$|^otp$|^answer$/i;

// A copy of a request body (or form data, turned into an object) that is safe to log: the value of every field whose name looks secret is replaced with '[redacted]', at any depth. The input is not changed.
export function redactForLog(value: unknown): unknown {
	// Arrays: redact each element.
	if (Array.isArray(value)) return value.map((element) => redactForLog(element));
	// Anything that is not a plain object is logged as it is.
	if (value === null || typeof value !== 'object') return value;
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>).map(([fieldName, fieldValue]) => [
			fieldName,
			SECRET_KEY_PATTERN.test(fieldName) ? '[redacted]' : redactForLog(fieldValue)
		])
	);
}
