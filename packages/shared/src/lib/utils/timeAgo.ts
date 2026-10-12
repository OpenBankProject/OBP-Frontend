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

const UNITS: [limitSeconds: number, secondsPerUnit: number, singular: string, plural: string][] = [
	[60 * 60, 60, 'min', 'mins'],
	[24 * 60 * 60, 60 * 60, 'hour', 'hours'],
	[30 * 24 * 60 * 60, 24 * 60 * 60, 'day', 'days'],
	[365 * 24 * 60 * 60, 30 * 24 * 60 * 60, 'month', 'months'],
	[Infinity, 365 * 24 * 60 * 60, 'year', 'years']
];

/** "just now", "5 mins ago", "3 days ago". Returns null for a date that does not parse. */
export function timeAgo(date: string | Date, now: Date = new Date()): string | null {
	const then = date instanceof Date ? date.getTime() : Date.parse(date);
	if (!Number.isFinite(then)) return null;
	const seconds = Math.max(0, (now.getTime() - then) / 1000);
	if (seconds < 60) return 'just now';
	for (const [limit, perUnit, singular, plural] of UNITS) {
		if (seconds < limit) {
			const n = Math.floor(seconds / perUnit);
			return `${n} ${n === 1 ? singular : plural} ago`;
		}
	}
	return null;
}
