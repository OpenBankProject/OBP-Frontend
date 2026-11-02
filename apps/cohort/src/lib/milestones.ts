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
 * Milestones: what a programme's startups must reach, their reports, and staff reviews of the reports. A milestone's
 * status for a startup follows from its newest report and the reviews: accepted once any report is accepted;
 * otherwise returned or submitted by the newest report's latest review; not started without a report. A startup is
 * behind on a milestone past its due date and not accepted.
 */

export interface Milestone {
	id: string;
	programme_id: string;
	title: string;
	description: string;
	due_on: string;
	position: number;
}

export interface MilestoneReport {
	id: string;
	milestone_id: string;
	participant_id: string;
	note: string;
	submitted_at: string;
}

export interface MilestoneReview {
	report_id: string;
	milestone_id: string;
	participant_id: string;
	decision: string;
	message_to_startup: string;
	decided_at: string;
}

export type MilestoneStatus = 'not_started' | 'submitted' | 'returned' | 'accepted';
export const REVIEW_DECISIONS = ['accepted', 'returned'] as const;

export function milestoneOf(id: string, record: Record<string, unknown>): Milestone {
	return {
		id,
		programme_id: String(record.programme_id ?? ''),
		title: String(record.title ?? ''),
		description: String(record.description ?? ''),
		due_on: String(record.due_on ?? ''),
		position: Number(record.position ?? 0)
	};
}

export function sortedMilestones(milestones: Milestone[]): Milestone[] {
	return [...milestones].sort((a, b) => a.position - b.position || a.due_on.localeCompare(b.due_on) || a.title.localeCompare(b.title));
}

const newestFirst = <T>(items: T[], at: (item: T) => string) => [...items].sort((a, b) => at(b).localeCompare(at(a)));

export interface MilestoneProgress {
	status: MilestoneStatus;
	behind: boolean;
	latestReport: MilestoneReport | null;
	/** The latest review of the newest report, if any: its message is what the startup is told. */
	latestReview: MilestoneReview | null;
}

/** `today` is YYYY-MM-DD. */
export function milestoneProgress(
	milestone: Milestone,
	participantId: string,
	reports: MilestoneReport[],
	reviews: MilestoneReview[],
	today: string
): MilestoneProgress {
	const own = newestFirst(reports.filter((r) => r.milestone_id === milestone.id && r.participant_id === participantId), (r) => r.submitted_at);
	const reviewsOf = (reportId: string) => newestFirst(reviews.filter((v) => v.report_id === reportId), (v) => v.decided_at);
	const accepted = own.some((r) => reviewsOf(r.id)[0]?.decision === 'accepted');
	const latestReport = own[0] ?? null;
	const latestReview = latestReport ? (reviewsOf(latestReport.id)[0] ?? null) : null;
	const status: MilestoneStatus = accepted
		? 'accepted'
		: !latestReport
			? 'not_started'
			: latestReview?.decision === 'returned'
				? 'returned'
				: 'submitted';
	return { status, behind: status !== 'accepted' && !!milestone.due_on && milestone.due_on < today, latestReport, latestReview };
}

/** Today as YYYY-MM-DD (UTC), as due_on is stored. */
export function todayUtc(date = new Date()): string {
	return date.toISOString().slice(0, 10);
}
