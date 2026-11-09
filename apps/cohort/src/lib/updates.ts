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
 * In-app notifications: what is new for the User (announcements, outcomes of their applications, staff reviews of
 * their milestone reports) and what is coming up (their booked sessions and milestones due within a week). Built from
 * the records each time, so nothing is stored but when the User last looked.
 */

export type UpdateKind = 'announcement' | 'decision' | 'milestone_review' | 'session_soon' | 'milestone_due' | 'milestone_overdue';

export interface Update {
	key: string;
	kind: UpdateKind;
	/** When it happened, or when it is due (ISO 8601). */
	at: string;
	title: string;
	detail: string;
	/** What it says: the decision or review outcome, for the label. */
	outcome: string;
	href: string;
	/** Newer than the User's last look at their updates. */
	new: boolean;
}

export interface UpdatesInput {
	announcements: { id: string; title: string; body: string; published_at: string }[];
	outcomes: { application_id: string; call: string; decision: string; message: string; decided_at: string }[];
	reviews: { report_id: string; milestone: string; decision: string; message: string; decided_at: string }[];
	/** The User's booked sessions. starts_at is local time, as nowLocal. */
	sessions: { id: string; title: string; starts_at: string }[];
	milestones: { id: string; participant_id: string; title: string; due_on: string; status: string; behind: boolean }[];
	/** nowLocal() and todayUtc(). */
	now: string;
	today: string;
	/** When the User last looked, or '' for never. */
	seenAt: string;
}

const WEEK_DAYS = 7;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export function updatesFeed(input: UpdatesInput): { upcoming: Update[]; recent: Update[] } {
	const isNew = (at: string) => !input.seenAt || at > input.seenAt;
	const recent: Update[] = [
		...input.announcements.map((a) => ({ key: `a:${a.id}`, kind: 'announcement' as const, at: a.published_at, title: a.title, detail: a.body, outcome: '', href: '' })),
		...input.outcomes
			.filter((o) => o.decided_at)
			.map((o) => ({ key: `d:${o.application_id}:${o.decided_at}`, kind: 'decision' as const, at: o.decided_at, title: o.call, detail: o.message, outcome: o.decision, href: `/applications/${o.application_id}` })),
		...input.reviews
			.filter((r) => r.decided_at)
			.map((r) => ({ key: `r:${r.report_id}:${r.decided_at}`, kind: 'milestone_review' as const, at: r.decided_at, title: r.milestone, detail: r.message, outcome: r.decision, href: '/programme' }))
	]
		.map((u) => ({ ...u, new: isNew(u.at) }))
		.sort((a, b) => b.at.localeCompare(a.at));

	const weekAhead = addDays(input.today, WEEK_DAYS);
	const upcoming: Update[] = [
		...input.sessions
			.filter((s) => s.starts_at > input.now && s.starts_at.slice(0, 10) <= weekAhead)
			.map((s) => ({ key: `s:${s.id}`, kind: 'session_soon' as const, at: s.starts_at, title: s.title, detail: '', outcome: '', href: '/programme' })),
		...input.milestones
			.filter((m) => m.status !== 'accepted' && m.status !== 'submitted' && m.due_on && (m.behind || m.due_on <= weekAhead))
			.map((m) => ({
				key: `m:${m.participant_id}:${m.id}`,
				kind: m.behind ? ('milestone_overdue' as const) : ('milestone_due' as const),
				at: m.due_on,
				title: m.title,
				detail: '',
				outcome: '',
				href: '/programme'
			}))
	]
		.map((u) => ({ ...u, new: false }))
		.sort((a, b) => a.at.localeCompare(b.at));
	return { upcoming, recent };
}
