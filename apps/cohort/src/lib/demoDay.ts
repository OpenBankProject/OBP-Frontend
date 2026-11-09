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

/** A demo day's running order, its guests and the feedback on pitches. */

export interface DemoSlot {
	id: string;
	session_id: string;
	participant_id: string;
	startup_name: string;
	position: number;
	starts_at: string;
	pitch_title: string;
}

export const GUEST_STATUSES = ['invited', 'confirmed', 'declined'] as const;
export type GuestStatus = (typeof GUEST_STATUSES)[number];

export interface DemoGuest {
	id: string;
	session_id: string;
	name: string;
	organisation: string;
	email: string;
	status: GuestStatus;
}

export interface PitchFeedback {
	id: string;
	session_id: string;
	participant_id: string;
	feedback: string;
	given_by_username: string;
	given_at: string;
}

const s = (r: Record<string, unknown>, k: string) => String(r[k] ?? '');

export function demoSlotOf(id: string, r: Record<string, unknown>): DemoSlot {
	const position = Number(r.position);
	return { id, session_id: s(r, 'session_id'), participant_id: s(r, 'participant_id'), startup_name: s(r, 'startup_name'), position: Number.isFinite(position) ? position : 0, starts_at: s(r, 'starts_at'), pitch_title: s(r, 'pitch_title') };
}

export function demoGuestOf(id: string, r: Record<string, unknown>): DemoGuest {
	const status = s(r, 'status');
	return { id, session_id: s(r, 'session_id'), name: s(r, 'name'), organisation: s(r, 'organisation'), email: s(r, 'email'), status: (GUEST_STATUSES as readonly string[]).includes(status) ? (status as GuestStatus) : 'invited' };
}

export function pitchFeedbackOf(id: string, r: Record<string, unknown>): PitchFeedback {
	return { id, session_id: s(r, 'session_id'), participant_id: s(r, 'participant_id'), feedback: s(r, 'feedback'), given_by_username: s(r, 'given_by_username'), given_at: s(r, 'given_at') };
}

/** The running order: by position, then time. */
export const runningOrder = (slots: DemoSlot[]) => [...slots].sort((a, b) => a.position - b.position || a.starts_at.localeCompare(b.starts_at));

/** The next free position in a demo day's running order. */
export const nextPosition = (slots: DemoSlot[]) => slots.reduce((max, slot) => Math.max(max, slot.position), 0) + 1;

/** Guests by status, for the demo day page's counts. */
export function guestCounts(guests: DemoGuest[]): Record<GuestStatus, number> {
	return Object.fromEntries(GUEST_STATUSES.map((st) => [st, guests.filter((g) => g.status === st).length])) as Record<GuestStatus, number>;
}
