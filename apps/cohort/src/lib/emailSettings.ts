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
 * Which emails Cohort sends on its own, and when: set by staff on the reminders page, kept in one
 * cohort_email_setting record. Without one, every email is sent, with the default timing.
 */
export interface EmailSettings {
	/** "We received your application", on submitting. */
	submitted: boolean;
	/** The outcome of a screening or evaluation decision. */
	decision: boolean;
	milestone_due: boolean;
	milestone_overdue: boolean;
	call_closing: boolean;
	/** Remind of a milestone this many days before it is due. */
	due_soon_days: number;
	/** Remind of an unsubmitted draft this many days before its call closes. */
	closing_soon_days: number;
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
	submitted: true,
	decision: true,
	milestone_due: true,
	milestone_overdue: true,
	call_closing: true,
	due_soon_days: 7,
	closing_soon_days: 3
};

export const EMAIL_SWITCHES = ['submitted', 'decision', 'milestone_due', 'milestone_overdue', 'call_closing'] as const;

const days = (v: unknown, fallback: number) => {
	const n = Number(v);
	return Number.isInteger(n) && n >= 0 && n <= 90 ? n : fallback;
};

export function emailSettingsOf(record: Record<string, unknown> | null | undefined): EmailSettings {
	if (!record) return DEFAULT_EMAIL_SETTINGS;
	const on = (key: (typeof EMAIL_SWITCHES)[number]) => (typeof record[key] === 'boolean' ? (record[key] as boolean) : DEFAULT_EMAIL_SETTINGS[key]);
	return {
		submitted: on('submitted'),
		decision: on('decision'),
		milestone_due: on('milestone_due'),
		milestone_overdue: on('milestone_overdue'),
		call_closing: on('call_closing'),
		due_soon_days: days(record.due_soon_days, DEFAULT_EMAIL_SETTINGS.due_soon_days),
		closing_soon_days: days(record.closing_soon_days, DEFAULT_EMAIL_SETTINGS.closing_soon_days)
	};
}
