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
import { milestoneOf, sortedMilestones, type Milestone, type MilestoneReport, type MilestoneReview } from '$lib/milestones';
import { requestApplicationAccessToken } from './applicationToken';
import { MILESTONE, MILESTONE_REPORT, MILESTONE_REVIEW } from './entities/definitions';
import { idOf, listRecords, type Access, type CohortRecord } from './records';

const logger = createLogger('CohortMilestones');

/**
 * Reading milestones. A programme's milestones are public. Reports are the startup's own personal records (read
 * through /my/), or every report through the community URL for staff with the Get Role. Reviews are read by staff
 * with their own Role; a startup's own are read by Cohort, narrowed to its own participant records.
 */

export async function milestonesOf(programmeId: string): Promise<Milestone[]> {
	const all = await listRecords(MILESTONE, 'public');
	return sortedMilestones(all.filter((m) => String(m.programme_id) === programmeId).map((m) => milestoneOf(idOf(MILESTONE, m), m)));
}

export function reportOf(record: CohortRecord): MilestoneReport {
	return {
		id: idOf(MILESTONE_REPORT, record),
		milestone_id: String(record.milestone_id ?? ''),
		participant_id: String(record.participant_id ?? ''),
		note: String(record.note ?? ''),
		submitted_at: String(record.submitted_at ?? '')
	};
}

export function reviewOf(record: CohortRecord): MilestoneReview {
	return {
		report_id: String(record.report_id ?? ''),
		milestone_id: String(record.milestone_id ?? ''),
		participant_id: String(record.participant_id ?? ''),
		decision: String(record.decision ?? ''),
		message_to_startup: String(record.message_to_startup ?? ''),
		decided_at: String(record.decided_at ?? '')
	};
}

/** The caller's own reports ('my'), or every report for staff ('community'). */
export async function reports(access: Extract<Access, 'my' | 'community'>, token: string): Promise<MilestoneReport[]> {
	return (await listRecords(MILESTONE_REPORT, access, token)).map(reportOf);
}

/** Every review, read with the staff member's own Role. */
export async function reviewsForStaff(token: string): Promise<MilestoneReview[]> {
	return (await listRecords(MILESTONE_REVIEW, '', token)).map(reviewOf);
}

/**
 * The reviews of a startup's own reports, read as Cohort (its Get Scope) and narrowed to the given participant ids,
 * which the caller has already checked are the logged-in User's. Empty, and logged, when Cohort cannot read them.
 */
export async function reviewsOfParticipants(participantIds: string[]): Promise<MilestoneReview[]> {
	if (participantIds.length === 0) return [];
	const { token } = await requestApplicationAccessToken();
	if (!token) return [];
	try {
		return (await listRecords(MILESTONE_REVIEW, '', token)).map(reviewOf).filter((v) => participantIds.includes(v.participant_id));
	} catch (err) {
		logger.warn('Cohort could not read milestone reviews (does it hold the Scope shown on /staff/setup?):', err);
		return [];
	}
}
