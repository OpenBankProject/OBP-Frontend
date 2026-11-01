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
/** Scoring and ranking for evaluation. Pure, so the pages and the tests share it. */

export interface Criterion {
	id: string;
	name: string;
	description: string;
	max_score: number;
	weight: number;
	position: number;
}

export interface Review {
	assignment_id: string;
	application_id: string;
	conflict_of_interest: boolean;
	total_score: number | null;
}

/** A criterion read from its record, with the defaults: weight 1, max_score at least 1. */
export function criterionOf(id: string, record: Record<string, unknown>): Criterion {
	return {
		id,
		name: String(record.name ?? ''),
		description: String(record.description ?? ''),
		max_score: Math.max(1, Math.trunc(Number(record.max_score) || 1)),
		weight: Math.max(1, Math.trunc(Number(record.weight) || 1)),
		position: Math.trunc(Number(record.position) || 0)
	};
}

export function sortedRubric(criteria: Criterion[]): Criterion[] {
	return [...criteria].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

/**
 * The weighted score out of 100, or null unless every criterion has a score within its range.
 * Weighted: each criterion counts score / max_score, times its weight.
 */
export function totalScore(rubric: Criterion[], scores: Record<string, number>): number | null {
	if (rubric.length === 0) return null;
	let got = 0;
	let possible = 0;
	for (const c of rubric) {
		const s = scores[c.id];
		if (typeof s !== 'number' || !Number.isInteger(s) || s < 0 || s > c.max_score) return null;
		got += (s / c.max_score) * c.weight;
		possible += c.weight;
	}
	return Math.round((100 * got) / possible);
}

export type AssignmentStatus = 'to_do' | 'conflict' | 'reviewed';

export function assignmentStatus(assignmentId: string, reviews: Review[]): AssignmentStatus {
	const review = reviews.find((r) => r.assignment_id === assignmentId);
	return !review ? 'to_do' : review.conflict_of_interest ? 'conflict' : 'reviewed';
}

export interface Ranked {
	application_id: string;
	average: number | null;
	reviews: number;
	rank: number | null;
}

/** Applications ranked by the average of their scored (non-conflicted) reviews; unscored ones come last, unranked. */
export function rankApplications(applicationIds: string[], reviews: Review[]): Ranked[] {
	const rows = applicationIds.map((application_id) => {
		const scored = reviews
			.filter((r) => r.application_id === application_id && !r.conflict_of_interest && r.total_score !== null)
			.map((r) => r.total_score as number);
		const average = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
		return { application_id, average, reviews: scored.length, rank: null as number | null };
	});
	rows.sort((a, b) => (b.average ?? -1) - (a.average ?? -1));
	let rank = 0;
	let previous: number | null = null;
	rows.forEach((row, i) => {
		if (row.average === null) return;
		if (row.average !== previous) rank = i + 1;
		row.rank = rank;
		previous = row.average;
	});
	return rows;
}

export type ReviewerStanding = 'pending' | 'accepted' | 'declined';

/** A reviewer's standing: the latest staff decision on their offer, pending until there is one. */
export function reviewerStanding(
	reviewerUserId: string,
	decisions: { reviewer_user_id?: unknown; decision?: unknown; decided_at?: unknown }[]
): ReviewerStanding {
	const latest = decisions
		.filter((d) => d.reviewer_user_id === reviewerUserId)
		.sort((a, b) => String(b.decided_at ?? '').localeCompare(String(a.decided_at ?? '')))[0];
	return latest?.decision === 'accepted' || latest?.decision === 'declined' ? latest.decision : 'pending';
}
