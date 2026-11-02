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

/**
 * Which reminders are due today: a milestone due within a week (or overdue) and not accepted, for each active
 * participant; and a call closing within three days, for each draft application to it. Each has a key, so one
 * already sent (in `sent`) is never planned again.
 */

export type ReminderKind = 'milestone_due' | 'milestone_overdue' | 'call_closing';

export interface PlannedReminder {
	key: string;
	kind: ReminderKind;
	customer_id: string;
	startup_name: string;
	/** The milestone title, or the call title. */
	about: string;
	/** The due date, or the closing date (YYYY-MM-DD). */
	on: string;
	/** The page the email links to. */
	path: string;
}

export interface ReminderInput {
	today: string;
	milestones: Milestone[];
	participants: { id: string; programme_id: string; startup_name: string; status: string; customer_id: string }[];
	reports: MilestoneReport[];
	reviews: MilestoneReview[];
	drafts: { id: string; call_id: string; startup_name: string; customer_id: string }[];
	calls: { id: string; title: string; closes_at: string; status: string }[];
	sent: Set<string>;
	dueSoonDays?: number;
	closingSoonDays?: number;
}

/** Whole days from `from` to `to`, both YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function planReminders(input: ReminderInput): PlannedReminder[] {
	const dueSoon = input.dueSoonDays ?? 7;
	const closingSoon = input.closingSoonDays ?? 3;
	const planned: PlannedReminder[] = [];
	const add = (r: PlannedReminder) => {
		if (r.customer_id && !input.sent.has(r.key)) planned.push(r);
	};

	for (const p of input.participants.filter((p) => p.status === 'active')) {
		for (const m of input.milestones.filter((m) => m.programme_id === p.programme_id && m.due_on)) {
			const progress = milestoneProgress(m, p.id, input.reports, input.reviews, input.today);
			if (progress.status === 'accepted') continue;
			const days = daysBetween(input.today, m.due_on);
			const base = { customer_id: p.customer_id, startup_name: p.startup_name, about: m.title, on: m.due_on, path: '/programme' };
			if (days < 0) add({ ...base, key: `milestone_overdue:${p.id}:${m.id}`, kind: 'milestone_overdue' });
			else if (days <= dueSoon && progress.status !== 'submitted') add({ ...base, key: `milestone_due:${p.id}:${m.id}`, kind: 'milestone_due' });
		}
	}

	const callById = new Map(input.calls.map((c) => [c.id, c]));
	for (const d of input.drafts) {
		const call = callById.get(d.call_id);
		if (!call || call.status !== 'open' || !call.closes_at) continue;
		const days = daysBetween(input.today, call.closes_at);
		if (days >= 0 && days <= closingSoon) {
			add({ key: `call_closing:${d.id}`, kind: 'call_closing', customer_id: d.customer_id, startup_name: d.startup_name, about: call.title, on: call.closes_at, path: `/applications/${d.id}` });
		}
	}
	return planned;
}
