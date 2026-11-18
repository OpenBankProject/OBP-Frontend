/*
 * Copyright (C) 2026 TESOBE GmbH
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
import { PARTICIPANT_CATEGORIES, PARTICIPANT_STAGES } from '@obp/shared/conformator';
import { currentStage } from './participants';

/**
 * The regulator's view across the ecosystem, counted from the records whenever it is shown, never stored: participants
 * by stage and kind, reports by standing and API family, each participant's position, recent runs, and the tests that
 * fail most. Spaces the User cannot read are counted as unknown, not as empty.
 */

type Rec = Record<string, any>;

export interface DashboardInput {
	participants: Rec[];
	/** Participant decisions, each with created_at. */
	decisions: Rec[];
	/** Reports with their standing worked out (valid, expired, superseded or withdrawn) and their parsed content. */
	reports: Array<{ standing: string; participant_id: string; content: Rec }>;
	suites: Rec[];
	/** For each participant space the User can read: its runs (with created_at), results and submissions. */
	spaces: Record<string, { runs: Rec[]; results: Rec[]; submissions: Rec[]; openSubmissions: number }>;
	/** Today, YYYY-MM-DD. */
	today: string;
}

export interface ParticipantRow {
	participant_id: string;
	legal_name: string;
	category: string;
	stage: string;
	space_id: string;
	valid_reports: string[];
	/** null when the User cannot read the space. */
	runs_last_30_days: number | null;
	last_run_at: string | null;
	open_submissions: number | null;
}

const daysBefore = (isoDate: string, days: number) => new Date(Date.parse(`${isoDate}T00:00:00Z`) - days * 86_400_000).toISOString();

export function buildDashboard(input: DashboardInput) {
	const byStage = Object.fromEntries([...PARTICIPANT_STAGES, 'not_admitted'].map((s) => [s, 0])) as Record<string, number>;
	const byCategory = Object.fromEntries(PARTICIPANT_CATEGORIES.map((c) => [c, 0])) as Record<string, number>;
	const since = daysBefore(input.today, 30);

	const rows: ParticipantRow[] = input.participants.map((p) => {
		const id = String(p.conformator_participant_id);
		const stage = currentStage(input.decisions.filter((d) => d.participant_id === id)) ?? 'not_admitted';
		byStage[stage] = (byStage[stage] ?? 0) + 1;
		byCategory[String(p.category)] = (byCategory[String(p.category)] ?? 0) + 1;
		const space = input.spaces[String(p.space_id)];
		const runs = space?.runs ?? [];
		return {
			participant_id: id,
			legal_name: String(p.legal_name),
			category: String(p.category),
			stage,
			space_id: String(p.space_id),
			valid_reports: input.reports.filter((r) => r.participant_id === id && r.standing === 'valid').map((r) => String(r.content?.suite?.code ?? '')),
			runs_last_30_days: space ? runs.filter((r) => String(r.created_at ?? '') >= since).length : null,
			last_run_at: space ? (runs.map((r) => String(r.created_at ?? '')).sort().at(-1) ?? null) : null,
			open_submissions: space ? space.openSubmissions : null
		};
	});

	const reportsByStanding: Record<string, number> = { valid: 0, expired: 0, superseded: 0, withdrawn: 0 };
	for (const r of input.reports) reportsByStanding[r.standing] = (reportsByStanding[r.standing] ?? 0) + 1;

	// Adoption: valid reports by the API family of their suite, and by the kind of participant.
	const familyOfCode = new Map(input.suites.map((s) => [String(s.code), String(s.api_family)]));
	const categoryOf = new Map(input.participants.map((p) => [String(p.conformator_participant_id), String(p.category)]));
	const validByFamily: Record<string, number> = {};
	const validByCategory: Record<string, number> = {};
	for (const r of input.reports.filter((r) => r.standing === 'valid')) {
		const family = familyOfCode.get(String(r.content?.suite?.code ?? '')) ?? 'unknown';
		validByFamily[family] = (validByFamily[family] ?? 0) + 1;
		const category = categoryOf.get(r.participant_id) ?? 'unknown';
		validByCategory[category] = (validByCategory[category] ?? 0) + 1;
	}

	// The tests that fail most, across the spaces the User can read: where participants struggle.
	const failures = new Map<string, { test_id: string; failures: number; participants: Set<string> }>();
	for (const [space, data] of Object.entries(input.spaces))
		for (const r of data.results.filter((r) => r.outcome === 'fail')) {
			const key = String(r.test_id);
			const entry = failures.get(key) ?? { test_id: key, failures: 0, participants: new Set<string>() };
			entry.failures++;
			entry.participants.add(space);
			failures.set(key, entry);
		}
	const mostFailed = [...failures.values()]
		.map((f) => ({ test_id: f.test_id, failures: f.failures, participants: f.participants.size }))
		.sort((a, b) => b.participants - a.participants || b.failures - a.failures || a.test_id.localeCompare(b.test_id))
		.slice(0, 10);

	const readable = Object.keys(input.spaces).length;
	return {
		participants: rows.sort((a, b) => a.legal_name.localeCompare(b.legal_name)),
		byStage,
		byCategory,
		reportsByStanding,
		validByFamily,
		validByCategory,
		mostFailed,
		spacesReadable: readable,
		spacesTotal: new Set(input.participants.map((p) => String(p.space_id))).size
	};
}

export type Dashboard = ReturnType<typeof buildDashboard>;

/** CSV text from rows, with a header line. Values with commas, quotes or line breaks are quoted, as RFC 4180 says. */
export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
	const cell = (value: unknown) => {
		const text = value === null || value === undefined ? '' : Array.isArray(value) ? value.join('; ') : String(value);
		// A leading =, +, - or @ would be read as a formula by a spreadsheet, so it is made plain text.
		const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
		return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
	};
	return [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}
