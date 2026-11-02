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
import { createLogger } from '@obp/shared/utils';
import { sessionOf, type Attendance, type Booking, type Session } from '$lib/sessions';
import { requestApplicationAccessToken } from './applicationToken';
import { ATTENDANCE, SESSION, SESSION_BOOKING } from './entities/definitions';
import { idOf, listRecords, type CohortRecord } from './records';

const logger = createLogger('CohortSessions');

/**
 * Reading sessions, bookings and attendance. Staff read them with their own Roles. For a startup, Cohort reads them
 * with its Scopes and narrows them on the server: the sessions of the startup's own programmes, the number of seats
 * taken on each (never who took them), and the startup's own attendance.
 */

export function bookingOf(r: CohortRecord): Booking {
	return {
		id: idOf(SESSION_BOOKING, r),
		session_id: String(r.session_id ?? ''),
		participant_id: String(r.participant_id ?? ''),
		startup_name: String(r.startup_name ?? ''),
		booked_at: String(r.booked_at ?? '')
	};
}

export function attendanceOf(r: CohortRecord): Attendance {
	return {
		session_id: String(r.session_id ?? ''),
		participant_id: String(r.participant_id ?? ''),
		attended: r.attended === true || r.attended === 'true',
		recorded_at: String(r.recorded_at ?? '')
	};
}

export const sessionsFromRecords = (records: CohortRecord[]): Session[] => records.map((r) => sessionOf(idOf(SESSION, r), r));

async function asCohort<T>(what: string, read: (token: string) => Promise<T>, fallback: T): Promise<T> {
	const { token } = await requestApplicationAccessToken();
	if (!token) return fallback;
	try {
		return await read(token);
	} catch (err) {
		logger.warn(`Cohort could not read ${what} (does it hold the Scopes shown on /staff/setup?):`, err);
		return fallback;
	}
}

/** The sessions of these programmes (the startup's own), read as Cohort. */
export const sessionsOfProgrammes = (programmeIds: string[]) =>
	asCohort('sessions', async (token) => sessionsFromRecords(await listRecords(SESSION, '', token)).filter((s) => programmeIds.includes(s.programme_id)), [] as Session[]);

/** Seats taken on each session, read as Cohort from every booking: a count only. */
export const seatsTaken = () =>
	asCohort(
		'session bookings',
		async (token) => {
			const counts = new Map<string, number>();
			for (const b of (await listRecords(SESSION_BOOKING, 'community', token)).map(bookingOf)) counts.set(b.session_id, (counts.get(b.session_id) ?? 0) + 1);
			return counts;
		},
		new Map<string, number>()
	);

/** The attendance of these participants (the startup's own), read as Cohort. */
export const attendanceOfParticipants = (participantIds: string[]) =>
	asCohort('attendance', async (token) => (await listRecords(ATTENDANCE, '', token)).map(attendanceOf).filter((a) => participantIds.includes(a.participant_id)), [] as Attendance[]);
