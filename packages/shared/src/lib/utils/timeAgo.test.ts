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
import { describe, it, expect } from 'vitest';
import { timeAgo } from './timeAgo';

const now = new Date('2026-10-12T12:00:00Z');
const before = (seconds: number) => new Date(now.getTime() - seconds * 1000);

describe('timeAgo', () => {
	it('says just now under a minute', () => {
		expect(timeAgo(before(30), now)).toBe('just now');
	});
	it('counts minutes, hours, days, months and years', () => {
		expect(timeAgo(before(60), now)).toBe('1 min ago');
		expect(timeAgo(before(59 * 60), now)).toBe('59 mins ago');
		expect(timeAgo(before(2 * 3600), now)).toBe('2 hours ago');
		expect(timeAgo(before(3 * 86400), now)).toBe('3 days ago');
		expect(timeAgo(before(65 * 86400), now)).toBe('2 months ago');
		expect(timeAgo(before(800 * 86400), now)).toBe('2 years ago');
	});
	it('parses ISO strings and treats future dates as just now', () => {
		expect(timeAgo('2026-10-12T11:00:00Z', now)).toBe('1 hour ago');
		expect(timeAgo('2026-10-12T13:00:00Z', now)).toBe('just now');
	});
	it('returns null for an unparseable date', () => {
		expect(timeAgo('not a date', now)).toBeNull();
	});
});
