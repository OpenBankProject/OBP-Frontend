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
import { describe, expect, it } from 'vitest';
import { attended, seatsLeft, sessionOf, sessionsAttended } from './sessions';

describe('sessions', () => {
	const slot = sessionOf('s1', { programme_id: 'p', title: 'Clinic', kind: 'mentoring', starts_at: '2027-03-01T10:00', capacity: 2 });

	it('counts seats left from every booking of the session', () => {
		const bookings = [
			{ id: 'b1', session_id: 's1', participant_id: 'a', startup_name: '', booked_at: '' },
			{ id: 'b2', session_id: 'other', participant_id: 'b', startup_name: '', booked_at: '' }
		];
		expect(seatsLeft(slot, bookings)).toBe(1);
		expect(seatsLeft(slot, [...bookings, { ...bookings[0], id: 'b3', participant_id: 'c' }])).toBe(0);
		expect(sessionOf('x', {}).capacity).toBe(1);
	});

	it('takes the latest attendance record, and counts sessions attended', () => {
		const records = [
			{ session_id: 's1', participant_id: 'a', attended: false, recorded_at: '2027-03-01T12:00:00Z' },
			{ session_id: 's1', participant_id: 'a', attended: true, recorded_at: '2027-03-01T13:00:00Z' },
			{ session_id: 's2', participant_id: 'a', attended: true, recorded_at: '2027-03-02T12:00:00Z' },
			{ session_id: 's3', participant_id: 'a', attended: false, recorded_at: '2027-03-03T12:00:00Z' }
		];
		expect(attended('s1', 'a', records)).toBe(true);
		expect(attended('s1', 'b', records)).toBeUndefined();
		expect(sessionsAttended('a', records)).toBe(2);
	});
});
