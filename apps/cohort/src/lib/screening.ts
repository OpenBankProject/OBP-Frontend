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
/** Screening: the decisions staff make on a submitted application, and what each means for the applicant. */

export const DECISIONS = ['shortlisted', 'rejected', 'needs_info'] as const;
export type Decision = (typeof DECISIONS)[number];

export interface DecisionRecord {
	application_id?: unknown;
	decision?: unknown;
	decided_at?: unknown;
	[key: string]: unknown;
}

export function isDecision(value: unknown): value is Decision {
	return typeof value === 'string' && (DECISIONS as readonly string[]).includes(value);
}

/** An application's decisions, newest first. decided_at is ISO 8601 UTC, so it sorts as text. */
export function decisionsFor<T extends DecisionRecord>(applicationId: string, all: T[]): T[] {
	return all
		.filter((d) => d.application_id === applicationId)
		.sort((a, b) => String(b.decided_at ?? '').localeCompare(String(a.decided_at ?? '')));
}

/** The current outcome: the newest decision, if there is one. */
export function latestDecision<T extends DecisionRecord>(applicationId: string, all: T[]): T | undefined {
	return decisionsFor(applicationId, all)[0];
}

/**
 * Whether the applicant may edit: a draft, or a submitted application staff asked for more information on after it
 * was submitted. Resubmitting then waits for a new decision.
 */
export function applicantMayEdit(application: Record<string, unknown>, latest: DecisionRecord | undefined): boolean {
	if (application.status !== 'submitted') return true;
	return latest?.decision === 'needs_info' && String(latest.decided_at ?? '') > String(application.submitted_at ?? '');
}

/** Now, as stored in decided_at and submitted_at: ISO 8601 UTC to the second. */
export function nowUtc(date = new Date()): string {
	return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
