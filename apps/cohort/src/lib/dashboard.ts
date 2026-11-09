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
import { milestoneProgress, type Milestone, type MilestoneReport, type MilestoneReview } from './milestones';
import { latestDecision } from './screening';
import { sessionsAttended, type Attendance } from './sessions';

/**
 * The management view: how each call's applications move through the funnel, and how each programme's startups are
 * doing. Counting only; the data is read elsewhere with the staff member's Roles.
 */

export interface FunnelApplication {
	id: string;
	call_id: string;
	status: string;
	eligibility: string;
}

export interface FunnelDecision {
	application_id: string;
	decision: string;
	decided_at: string;
	[key: string]: unknown;
}

export interface FunnelRow {
	call_id: string;
	call: string;
	started: number;
	submitted: number;
	eligible: number;
	shortlisted: number;
	accepted: number;
	waitlisted: number;
	rejected: number;
}

const EVALUATION = ['accepted', 'waitlisted'];

/**
 * Started counts drafts too; shortlisted is every application that passed screening (shortlisted, or decided at
 * evaluation); accepted, waitlisted and rejected follow each application's latest decision.
 */
export function funnelByCall(calls: { id: string; title: string }[], applications: FunnelApplication[], decisions: FunnelDecision[]): FunnelRow[] {
	return calls.map((call) => {
		const apps = applications.filter((a) => a.call_id === call.id);
		const submitted = apps.filter((a) => a.status === 'submitted');
		const latest = (id: string) => latestDecision(id, decisions)?.decision;
		const ever = (id: string, values: string[]) => decisions.some((d) => d.application_id === id && values.includes(d.decision));
		return {
			call_id: call.id,
			call: call.title,
			started: apps.length,
			submitted: submitted.length,
			eligible: submitted.filter((a) => a.eligibility === 'eligible').length,
			shortlisted: submitted.filter((a) => ever(a.id, ['shortlisted', ...EVALUATION])).length,
			accepted: submitted.filter((a) => latest(a.id) === 'accepted').length,
			waitlisted: submitted.filter((a) => latest(a.id) === 'waitlisted').length,
			rejected: submitted.filter((a) => latest(a.id) === 'rejected').length
		};
	});
}

/** A risk flag staff raise on a startup, with a note: none, something to watch, or at risk. */
export const RISK_LEVELS = ['none', 'watch', 'at_risk'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
export const riskOf = (value: unknown): RiskLevel => ((RISK_LEVELS as readonly unknown[]).includes(value) ? (value as RiskLevel) : 'none');

export interface DashboardParticipant {
	id: string;
	programme_id: string;
	startup_name: string;
	customer_id: string;
	stage: string;
	status: string;
	risk?: RiskLevel;
	risk_note?: string;
}

export interface ParticipantProgress {
	participant_id: string;
	startup_name: string;
	programme: string;
	stage: string;
	status: string;
	company_registered: boolean;
	milestones_accepted: number;
	milestones_total: number;
	behind: number;
	sessions_attended: number;
	risk: RiskLevel;
	risk_note: string;
}

export interface ProgrammeRow {
	programme_id: string;
	programme: string;
	participants: number;
	onboarded: number;
	in_programme: number;
	graduated: number;
	companies_registered: number;
	milestones_accepted: number;
	milestones_due: number;
	/** Accepted out of every startup's milestones, 0 to 100; null when there is nothing to count. */
	completion: number | null;
	behind_startups: number;
	/** Startups staff flagged as watch or at risk. */
	flagged_startups: number;
	sessions_attended: number;
}

export function participantProgress(
	participant: DashboardParticipant,
	programmeName: string,
	milestones: Milestone[],
	reports: MilestoneReport[],
	reviews: MilestoneReview[],
	today: string,
	attendance: Attendance[] = []
): ParticipantProgress {
	const own = milestones.filter((m) => m.programme_id === participant.programme_id);
	const progress = own.map((m) => milestoneProgress(m, participant.id, reports, reviews, today));
	return {
		participant_id: participant.id,
		startup_name: participant.startup_name,
		programme: programmeName,
		stage: participant.stage,
		status: participant.status,
		company_registered: !!participant.customer_id,
		milestones_accepted: progress.filter((p) => p.status === 'accepted').length,
		milestones_total: own.length,
		behind: progress.filter((p) => p.behind).length,
		sessions_attended: sessionsAttended(participant.id, attendance),
		risk: participant.risk ?? 'none',
		risk_note: participant.risk_note ?? ''
	};
}

export function programmeRows(programmes: { id: string; name: string }[], progress: (ParticipantProgress & { programme_id: string })[]): ProgrammeRow[] {
	return programmes.map((programme) => {
		const rows = progress.filter((p) => p.programme_id === programme.id);
		const due = rows.reduce((n, r) => n + r.milestones_total, 0);
		const accepted = rows.reduce((n, r) => n + r.milestones_accepted, 0);
		return {
			programme_id: programme.id,
			programme: programme.name,
			participants: rows.length,
			onboarded: rows.filter((r) => r.stage === 'onboarded').length,
			// Any stage between onboarding and graduating: a programme may have its own.
			in_programme: rows.filter((r) => r.stage !== 'onboarded' && r.stage !== 'graduated' && r.status !== 'graduated').length,
			graduated: rows.filter((r) => r.stage === 'graduated' || r.status === 'graduated').length,
			companies_registered: rows.filter((r) => r.company_registered).length,
			milestones_accepted: accepted,
			milestones_due: due,
			completion: due > 0 ? Math.round((accepted / due) * 100) : null,
			behind_startups: rows.filter((r) => r.behind > 0).length,
			flagged_startups: rows.filter((r) => r.risk !== 'none').length,
			sessions_attended: rows.reduce((n, r) => n + r.sessions_attended, 0)
		};
	});
}

/** RFC 4180 CSV: every field quoted, quotes doubled, CRLF line ends. */
export function toCsv(headers: string[], rows: (string | number | boolean | null)[][]): string {
	const field = (v: string | number | boolean | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
	return [headers, ...rows].map((row) => row.map(field).join(',')).join('\r\n') + '\r\n';
}
