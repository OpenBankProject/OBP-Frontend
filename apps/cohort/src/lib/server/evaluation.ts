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
import { criterionOf, reviewerStanding, sortedRubric, type Criterion, type Review, type ReviewerStanding } from '$lib/evaluation';
import { requestApplicationAccessToken } from './applicationToken';
import { RUBRIC_CRITERION, REVIEW, REVIEW_ASSIGNMENT, REVIEWER, REVIEWER_DECISION } from './entities/definitions';
import { idOf, listRecords, type CohortRecord } from './records';

/**
 * Reading evaluation records. A call's rubric is public. Assignments are read with
 * CanGetDynamicEntityRecord_cohort_review_assignment (staff and reviewers); the reviewer pool and every review through
 * the community URL with their Get Roles (staff). A reviewer reads their own profile and reviews through /my/.
 * Decisions on offers to review are read by Cohort itself, so reviewers need no Role to learn their standing.
 */

const logger = createLogger('CohortEvaluation');

export async function rubricOf(callId: string): Promise<Criterion[]> {
	const all = await listRecords(RUBRIC_CRITERION, 'public');
	return sortedRubric(all.filter((c) => String(c.call_id) === callId).map((c) => criterionOf(idOf(RUBRIC_CRITERION, c), c)));
}

export interface Assignment {
	id: string;
	application_id: string;
	call_id: string;
	reviewer_user_id: string;
	reviewer_name: string;
	assigned_at: string;
	due_on: string;
}

export function assignmentOf(record: CohortRecord): Assignment {
	return {
		id: idOf(REVIEW_ASSIGNMENT, record),
		application_id: String(record.application_id ?? ''),
		call_id: String(record.call_id ?? ''),
		reviewer_user_id: String(record.reviewer_user_id ?? ''),
		reviewer_name: String(record.reviewer_name ?? ''),
		assigned_at: String(record.assigned_at ?? ''),
		due_on: String(record.due_on ?? '')
	};
}

export async function assignments(token: string): Promise<Assignment[]> {
	return (await listRecords(REVIEW_ASSIGNMENT, '', token)).map(assignmentOf);
}

export interface FullReview extends Review {
	id: string;
	conflict_note: string;
	scores: Record<string, number>;
	comments: string;
	submitted_at: string;
}

export function reviewOf(record: CohortRecord): FullReview {
	let scores: Record<string, number> = {};
	try {
		const parsed = JSON.parse(String(record.scores_json ?? '{}'));
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) scores = parsed;
	} catch {
		// A review with unreadable scores still counts as written.
	}
	const total = Number(record.total_score);
	return {
		id: idOf(REVIEW, record),
		assignment_id: String(record.assignment_id ?? ''),
		application_id: String(record.application_id ?? ''),
		conflict_of_interest: record.conflict_of_interest === true,
		conflict_note: String(record.conflict_note ?? ''),
		total_score: record.total_score === undefined || record.total_score === null || Number.isNaN(total) ? null : total,
		scores,
		comments: String(record.comments ?? ''),
		submitted_at: String(record.submitted_at ?? '')
	};
}

/** Every review (staff, through the community URL), or only the caller's own. */
export async function reviews(token: string, access: 'community' | 'my'): Promise<FullReview[]> {
	return (await listRecords(REVIEW, access, token)).map(reviewOf);
}

export interface Reviewer {
	id: string;
	user_id: string;
	display_name: string;
	expertise: string;
	status: string;
}

export function reviewerOf(record: CohortRecord): Reviewer {
	return {
		id: idOf(REVIEWER, record),
		user_id: String(record.user_id ?? ''),
		display_name: String(record.display_name ?? ''),
		expertise: String(record.expertise ?? ''),
		status: String(record.status ?? 'available')
	};
}

/** The reviewer pool (staff), or the caller's own profile. */
export async function reviewers(token: string, access: 'community' | 'my'): Promise<Reviewer[]> {
	return (await listRecords(REVIEWER, access, token)).map(reviewerOf);
}

/** Every decision on an offer to review, read as Cohort itself (its Get Scope). Empty, and logged, when it cannot be read. */
export async function reviewerDecisionsAsCohort(): Promise<CohortRecord[]> {
	const { token } = await requestApplicationAccessToken();
	if (!token) return [];
	try {
		return await listRecords(REVIEWER_DECISION, '', token);
	} catch (err) {
		logger.warn('Cohort could not read reviewer decisions (does it hold the Scope shown on /staff/setup?):', err);
		return [];
	}
}

/** A User's standing as a reviewer. Pending when the decisions cannot be read, so nobody is let in by an error. */
export async function standingOf(userId: string): Promise<ReviewerStanding> {
	return reviewerStanding(userId, await reviewerDecisionsAsCohort());
}
