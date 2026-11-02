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
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The reads Cohort makes with its own token are not governed by the User's Entitlements, so Cohort's code is their
 * only guard: each must return only the logged-in User's own records, and never staff-only fields.
 */

const records: Record<string, unknown[]> = {};

vi.mock('./applicationToken', () => ({ requestApplicationAccessToken: async () => ({ token: 'cohort-token' }) }));
vi.mock('./records', async (importOriginal) => {
	const original = await importOriginal<typeof import('./records')>();
	return { ...original, listRecords: async (entity: string) => records[entity] ?? [] };
});

const { participantsOfUser } = await import('./participants');
const { outcomesForApplicant } = await import('./decisions');
const { standingOf } = await import('./evaluation');
const { reviewsOfParticipants } = await import('./milestones');
const { attendanceOfParticipants, seatsTaken, sessionsOfProgrammes } = await import('./sessions');

beforeEach(() => {
	for (const key of Object.keys(records)) delete records[key];
});

describe("reads made with Cohort's own token", () => {
	it("give a startup only its own participation", async () => {
		records.cohort_participant = [
			{ cohort_participant_id: 'p1', user_id: 'me', programme_id: 'prog', application_id: 'a1', stage: 'onboarded', status: 'active', joined_at: '2026-11-01T09:00:00Z' },
			{ cohort_participant_id: 'p2', user_id: 'someone-else', programme_id: 'prog', application_id: 'a2', stage: 'onboarded', status: 'active', joined_at: '2026-11-01T09:00:00Z' }
		];
		expect((await participantsOfUser('me')).map((p) => p.id)).toEqual(['p1']);
		expect(await participantsOfUser('nobody')).toEqual([]);
	});

	it("give an applicant only the outcome of the applications asked for, without the staff reason", async () => {
		records.cohort_screening_decision = [
			{ application_id: 'mine', decision: 'accepted', reason: 'Strong team, internal note', message_to_applicant: 'Welcome!', decided_at: '2026-11-01T10:00:00Z' },
			{ application_id: 'theirs', decision: 'rejected', reason: 'Weak', message_to_applicant: 'Sorry', decided_at: '2026-11-01T10:00:00Z' }
		];
		const outcomes = await outcomesForApplicant(['mine']);
		expect(Object.keys(outcomes)).toEqual(['mine']);
		expect(outcomes.mine).toEqual({ decision: 'accepted', message: 'Welcome!', decided_at: '2026-11-01T10:00:00Z' });
		expect(JSON.stringify(outcomes)).not.toContain('internal note');
	});

	it("give a reviewer only their own standing", async () => {
		records.cohort_reviewer_decision = [
			{ reviewer_user_id: 'someone-else', decision: 'accepted', decided_at: '2026-11-01T10:00:00Z' },
			{ reviewer_user_id: 'me', decision: 'declined', decided_at: '2026-11-01T10:00:00Z' }
		];
		expect(await standingOf('me')).toBe('declined');
		expect(await standingOf('nobody')).toBe('pending');
	});

	it("give a startup only the reviews of its own milestone reports", async () => {
		records.cohort_milestone_review = [
			{ report_id: 'r1', milestone_id: 'm1', participant_id: 'mine', decision: 'returned', message_to_startup: 'Add the contract', decided_at: '2027-02-02T10:00:00Z' },
			{ report_id: 'r2', milestone_id: 'm1', participant_id: 'theirs', decision: 'accepted', message_to_startup: '', decided_at: '2027-02-02T10:00:00Z' }
		];
		expect((await reviewsOfParticipants(['mine'])).map((v) => v.report_id)).toEqual(['r1']);
		expect(await reviewsOfParticipants([])).toEqual([]);
	});

	it("give a startup only its own programme's sessions, a seat count without names, and its own attendance", async () => {
		records.cohort_session = [
			{ cohort_session_id: 's1', programme_id: 'mine', title: 'Clinic', kind: 'mentoring', starts_at: '2027-03-01T10:00', capacity: 2 },
			{ cohort_session_id: 's2', programme_id: 'other', title: 'Other', kind: 'workshop', starts_at: '2027-03-01T10:00', capacity: 9 }
		];
		records.cohort_session_booking = [
			{ cohort_session_booking_id: 'b1', session_id: 's1', participant_id: 'someone-else', startup_name: 'Secret Co', booked_at: '' },
			{ cohort_session_booking_id: 'b2', session_id: 's1', participant_id: 'me', startup_name: 'Mine', booked_at: '' }
		];
		records.cohort_attendance = [
			{ session_id: 's1', participant_id: 'me', attended: true, recorded_at: '2027-03-01T12:00:00Z' },
			{ session_id: 's1', participant_id: 'someone-else', attended: true, recorded_at: '2027-03-01T12:00:00Z' }
		];
		expect((await sessionsOfProgrammes(['mine'])).map((s) => s.id)).toEqual(['s1']);
		const taken = await seatsTaken();
		expect([...taken.entries()]).toEqual([['s1', 2]]);
		expect(JSON.stringify([...taken.entries()])).not.toContain('Secret Co');
		expect((await attendanceOfParticipants(['me'])).map((a) => a.participant_id)).toEqual(['me']);
	});
});
