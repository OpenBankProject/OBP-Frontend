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
// Mirrors the check OBP applies to a user's own mobile phone number
// (InvalidPhoneNumber in v7.0.0: POST /users, PUT /my/user/mobile-phone-number):
// an optional leading "+", then 5-50 characters of digits, spaces, dashes,
// dots and parentheses. Kept as a source string so the same rule can feed both
// an HTML `pattern` attribute (which anchors implicitly) and a RegExp.
//
// Browsers compile `pattern` with the RegExp `v` flag, under which "(" ")" and
// "." inside a character class must be escaped — an unescaped one makes the
// whole pattern invalid and the browser silently skips validation.
export const MOBILE_PHONE_NUMBER_PATTERN_SOURCE = '\\+?[0-9\\-\\s\\(\\)\\.]{5,50}';
export const MOBILE_PHONE_NUMBER_PATTERN = new RegExp(`^${MOBILE_PHONE_NUMBER_PATTERN_SOURCE}$`);

export function isMobilePhoneNumberValid(value: string): boolean {
	return MOBILE_PHONE_NUMBER_PATTERN.test(value);
}
