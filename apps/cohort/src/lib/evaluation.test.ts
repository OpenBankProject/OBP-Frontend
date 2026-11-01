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
import { assignmentStatus, criterionOf, rankApplications, reviewerStanding, totalScore } from './evaluation';

const team = criterionOf('team', { name: 'Team', max_score: 5, weight: 2 });
const market = criterionOf('market', { name: 'Market', max_score: 10 });

describe('totalScore', () => {
	it('weights each criterion by score over its maximum', () => {
		// team 5/5 counts twice, market 5/10 once: (2 * 1 + 0.5) / 3 = 83%
		expect(totalScore([team, market], { team: 5, market: 5 })).toBe(83);
		expect(totalScore([team, market], { team: 0, market: 0 })).toBe(0);
	});

	it('needs a whole score within range for every criterion', () => {
		expect(totalScore([team, market], { team: 5 })).toBeNull();
		expect(totalScore([team, market], { team: 6, market: 1 })).toBeNull();
		expect(totalScore([team, market], { team: 2.5, market: 1 })).toBeNull();
		expect(totalScore([], {})).toBeNull();
	});

	it('defaults weight to 1 and max_score to at least 1', () => {
		expect(criterionOf('x', { name: 'X' })).toMatchObject({ weight: 1, max_score: 1 });
	});
});

describe('evaluation status and ranking', () => {
	const reviews = [
		{ assignment_id: 'a1', application_id: 'app1', conflict_of_interest: false, total_score: 80 },
		{ assignment_id: 'a2', application_id: 'app1', conflict_of_interest: false, total_score: 60 },
		{ assignment_id: 'a3', application_id: 'app2', conflict_of_interest: false, total_score: 70 },
		{ assignment_id: 'a4', application_id: 'app2', conflict_of_interest: true, total_score: null },
		{ assignment_id: 'a5', application_id: 'app3', conflict_of_interest: false, total_score: 70 }
	];

	it('tells an assignment that is to do, declined for a conflict, or reviewed', () => {
		expect(assignmentStatus('a1', reviews)).toBe('reviewed');
		expect(assignmentStatus('a4', reviews)).toBe('conflict');
		expect(assignmentStatus('a9', reviews)).toBe('to_do');
	});

	it('ranks by the average of scored reviews, ties share a rank, unscored come last', () => {
		const ranked = rankApplications(['app4', 'app2', 'app1', 'app3'], reviews);
		expect(ranked.map((r) => [r.application_id, r.average, r.rank])).toEqual([
			['app2', 70, 1],
			['app1', 70, 1],
			['app3', 70, 1],
			['app4', null, null]
		]);
		expect(ranked.find((r) => r.application_id === 'app2')?.reviews).toBe(1);
	});
});

describe('reviewerStanding', () => {
	it('is pending until staff decide, then follows the latest decision', () => {
		expect(reviewerStanding('u1', [])).toBe('pending');
		const decisions = [
			{ reviewer_user_id: 'u1', decision: 'declined', decided_at: '2026-11-01T09:00:00Z' },
			{ reviewer_user_id: 'u1', decision: 'accepted', decided_at: '2026-11-02T09:00:00Z' },
			{ reviewer_user_id: 'u2', decision: 'declined', decided_at: '2026-11-03T09:00:00Z' }
		];
		expect(reviewerStanding('u1', decisions)).toBe('accepted');
		expect(reviewerStanding('u2', decisions)).toBe('declined');
		expect(reviewerStanding('u3', decisions)).toBe('pending');
	});
});
