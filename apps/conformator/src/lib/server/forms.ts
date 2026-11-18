/*
 * Copyright (C) 2026 TESOBE GmbH
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
/** Reading form fields: trimmed text, an empty field as '', and the problems found, in plain words. */
export function fields(form: FormData) {
	const problems: string[] = [];
	const text = (name: string, label: string, opts: { required?: boolean; max?: number } = {}) => {
		const value = String(form.get(name) ?? '').trim();
		if (opts.required && value === '') problems.push(`${label} is needed.`);
		if (opts.max && value.length > opts.max) problems.push(`${label} is longer than ${opts.max} characters.`);
		return value;
	};
	return { text, problems };
}

/** A URL the runner may read a document from: https, or http on localhost while trying things out. */
export function isDocumentUrl(value: string): boolean {
	return /^https:\/\/\S+$/.test(value) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/\S*$/.test(value);
}
