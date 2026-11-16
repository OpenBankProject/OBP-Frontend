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

/**
 * Words both OBP-Conformator apps use: the web app stores them in records, and the runner reads and writes
 * them. Each list is fixed in code, so a record holding anything else is a mistake to report, not a new value.
 */

/** What a test checks, and so who decides its outcome. */
export const TEST_KINDS = ['automated', 'evidence', 'control'] as const;
export type TestKind = (typeof TEST_KINDS)[number];

/** The part a participant's system plays in a test. */
export const SYSTEM_ROLES = ['api_provider', 'authorisation_server', 'api_consumer'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

/** The groups of APIs a suite can cover. */
export const API_FAMILIES = ['account_information', 'payment_initiation', 'funds_confirmation', 'consent', 'security'] as const;
export type ApiFamily = (typeof API_FAMILIES)[number];

/** The kinds of organisation that take part. */
export const PARTICIPANT_CATEGORIES = ['bank', 'payment_service_provider', 'fintech', 'finance_or_leasing', 'third_party_provider'] as const;
export type ParticipantCategory = (typeof PARTICIPANT_CATEGORIES)[number];

/** A participant's lifecycle, in order. The latest participant decision says where they are. */
export const PARTICIPANT_STAGES = ['admitted', 'onboarding', 'testing', 'remediation', 'graduated', 'suspended', 'exited'] as const;
export type ParticipantStage = (typeof PARTICIPANT_STAGES)[number];

/** A suite version's status. An approved version never changes; a change is a new version. */
export const SUITE_STATUSES = ['draft', 'approved', 'retired'] as const;
export type SuiteStatus = (typeof SUITE_STATUSES)[number];

/** How serious a failed test is. */
export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];

/** The outcome of one test in one run. */
export const OUTCOMES = ['pass', 'fail', 'blocked', 'not_executed', 'not_applicable'] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** Whose side stopped a blocked test: the runner's own ("harness") or the participant's. */
export const BLOCKED_BY = ['harness', 'participant'] as const;
export type BlockedBy = (typeof BLOCKED_BY)[number];

/** A run's status. */
export const RUN_STATUSES = ['queued', 'running', 'finished', 'harness_error'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** Whether a word is one of a list, for checking form input and records. */
export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
	return typeof value === 'string' && (list as readonly string[]).includes(value);
}

/**
 * A test ID: two to four groups of capital letters or digits joined by hyphens, such as `PIS-IDEM-004`. It names the
 * test in reports and in the participant's CI, so it never changes.
 */
export function isTestId(value: string): boolean {
	return /^[A-Z0-9]{2,12}(-[A-Z0-9]{1,12}){1,3}$/.test(value);
}
