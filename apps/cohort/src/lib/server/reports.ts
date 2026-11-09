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
import { toCsv } from '$lib/dashboard';
import { answersOf, type Form } from '$lib/forms';
import { tablePdf, type Table } from '$lib/pdf';
import { dashboardData } from './dashboard';
import { answersRecords } from './forms';

/** A report staff can download, as CSV or PDF: the same table either way. */
export interface Report extends Table {
	/** The file name without its extension. */
	filename: string;
}

export type ReportFormat = 'csv' | 'pdf';

/** The funnel of each call, read with the staff member's own Roles. */
export async function funnelReport(token: string): Promise<Report> {
	const { funnel } = await dashboardData(token);
	return {
		filename: 'cohort-funnel',
		title: 'Applications by call',
		headers: ['call', 'started', 'submitted', 'eligible', 'shortlisted', 'accepted', 'waitlisted', 'not_selected'],
		rows: funnel.map((r) => [r.call, r.started, r.submitted, r.eligible, r.shortlisted, r.accepted, r.waitlisted, r.rejected])
	};
}

/** Every participating startup's progress, read with the staff member's own Roles. */
export async function startupsReport(token: string): Promise<Report> {
	const { startups } = await dashboardData(token);
	return {
		filename: 'cohort-startups',
		title: 'Startups in programmes',
		headers: ['startup', 'programme', 'stage', 'status', 'company_registered', 'milestones_accepted', 'milestones_total', 'milestones_behind', 'sessions_attended', 'risk', 'risk_note'],
		rows: startups.map((s) => [s.startup_name, s.programme, s.stage, s.status, s.company_registered, s.milestones_accepted, s.milestones_total, s.behind, s.sessions_attended, s.risk, s.risk_note])
	};
}

/** Every submitted answer to a form, one column per question, read with its dynamic entity's Get Role. */
export async function formAnswersReport(form: Form, token: string): Promise<Report> {
	const records = (await answersRecords(form, 'community', token)).filter((r) => r.submitted_at);
	return {
		filename: `${form.entity_name || 'cohort-form'}-answers`,
		title: `Answers: ${form.title || form.title_ar || form.entity_name}`,
		headers: [form.purpose === 'survey' ? 'participant_id' : 'application_id', 'startup', 'submitted_at', ...form.questions.map((q) => q.key)],
		rows: records.map((r) => {
			const answers = answersOf(form.questions, r.record);
			return [r.subject_id, r.startup_name, r.submitted_at, ...form.questions.map((q) => answers[q.key] ?? '')];
		})
	};
}

/** The report as a download in the format asked for. */
export function reportResponse(report: Report, format: ReportFormat): Response {
	const disposition = `attachment; filename="${report.filename}.${format}"`;
	if (format === 'pdf') return new Response(tablePdf(report), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': disposition } });
	return new Response(toCsv(report.headers, report.rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': disposition } });
}
