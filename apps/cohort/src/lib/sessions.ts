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
 * Sessions of a programme: mentoring slots, workshops and demo days, the seats startups book, and the attendance
 * staff record. starts_at is YYYY-MM-DDTHH:MM in the programme's local time, so it sorts and compares as text.
 */

export const SESSION_KINDS = ['mentoring', 'workshop', 'office_hours', 'demo_day'] as const;

export interface Session {
	id: string;
	programme_id: string;
	title: string;
	kind: string;
	starts_at: string;
	duration_minutes: number;
	location: string;
	mentor_name: string;
	capacity: number;
}

export interface Booking {
	id: string;
	session_id: string;
	participant_id: string;
	startup_name: string;
	booked_at: string;
}

export interface Attendance {
	session_id: string;
	participant_id: string;
	attended: boolean;
	recorded_at: string;
}

export function sessionOf(id: string, r: Record<string, unknown>): Session {
	return {
		id,
		programme_id: String(r.programme_id ?? ''),
		title: String(r.title ?? ''),
		kind: String(r.kind ?? 'mentoring'),
		starts_at: String(r.starts_at ?? ''),
		duration_minutes: Number(r.duration_minutes ?? 60),
		location: String(r.location ?? ''),
		mentor_name: String(r.mentor_name ?? ''),
		capacity: Math.max(1, Number(r.capacity ?? 1))
	};
}

export const byStart = (a: Session, b: Session) => a.starts_at.localeCompare(b.starts_at);

/** Seats left on a session, from every startup's bookings. */
export function seatsLeft(session: Session, bookings: Booking[]): number {
	return Math.max(0, session.capacity - bookings.filter((b) => b.session_id === session.id).length);
}

/** Whether a startup attended a session: the latest record for the two counts; undefined when none was made. */
export function attended(sessionId: string, participantId: string, records: Attendance[]): boolean | undefined {
	return records
		.filter((a) => a.session_id === sessionId && a.participant_id === participantId)
		.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0]?.attended;
}

/** How many sessions a startup attended. */
export function sessionsAttended(participantId: string, records: Attendance[]): number {
	const sessions = new Set(records.filter((a) => a.participant_id === participantId).map((a) => a.session_id));
	return [...sessions].filter((s) => attended(s, participantId, records) === true).length;
}

/** Now as YYYY-MM-DDTHH:MM, to compare with starts_at. */
export function nowLocal(date = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
