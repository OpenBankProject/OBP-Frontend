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
import { announcementsFor, inReaderLocale } from '$lib/announcements';
import { milestoneProgress, todayUtc } from '$lib/milestones';
import { nowUtc } from '$lib/screening';
import { nowLocal } from '$lib/sessions';
import { updatesFeed } from '$lib/updates';
import { allAnnouncements } from '$lib/server/announcements';
import { outcomesForApplicant } from '$lib/server/decisions';
import { APPLICATION, CALL, SESSION_BOOKING } from '$lib/server/entities/definitions';
import { milestonesOf, reports, reviewsOfParticipants } from '$lib/server/milestones';
import { participantsOfUser } from '$lib/server/participants';
import { idOf, listRecords, userToken } from '$lib/server/records';
import { bookingOf, sessionsOfProgrammes } from '$lib/server/sessions';
import type { PageServerLoad } from './$types';

/**
 * The User's updates, read as on their own pages: their applications (/my/) and outcomes, their programmes' records
 * through Cohort narrowed to their own participants, and the public announcements. Opening the page marks them seen.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const userId = locals.session.data.user?.user_id ?? '';
	const [applications, calls, participants, announcements] = await Promise.all([
		listRecords(APPLICATION, 'my', token).catch(() => []),
		listRecords(CALL, 'public').catch(() => []),
		participantsOfUser(userId),
		allAnnouncements()
	]);
	const participantIds = participants.map((p) => p.id);
	const programmeIds = participants.map((p) => p.programme_id);
	const [outcomes, myReports, myReviews, sessions, bookings, milestoneLists] = await Promise.all([
		outcomesForApplicant(applications.map((a) => idOf(APPLICATION, a))).catch(() => ({}) as Awaited<ReturnType<typeof outcomesForApplicant>>),
		reports('my', token).catch(() => []),
		reviewsOfParticipants(participantIds),
		sessionsOfProgrammes(programmeIds),
		listRecords(SESSION_BOOKING, 'my', token).then((r) => r.map(bookingOf)).catch(() => []),
		Promise.all(participants.map((p) => milestonesOf(p.programme_id).catch(() => [])))
	]);

	const callTitle = new Map(calls.map((c) => [idOf(CALL, c), String(c.title ?? '')]));
	const today = todayUtc();
	const milestones = participants.flatMap((p, i) =>
		milestoneLists[i].map((m) => {
			const progress = milestoneProgress(m, p.id, myReports, myReviews, today);
			return { id: m.id, participant_id: p.id, title: m.title, due_on: m.due_on, status: progress.status, behind: progress.behind };
		})
	);
	const milestoneTitle = new Map(milestoneLists.flat().map((m) => [m.id, m.title]));
	const booked = new Set(bookings.filter((b) => participantIds.includes(b.participant_id)).map((b) => b.session_id));

	const seenAt = locals.session.data.updates_seen_at ?? '';
	const feed = updatesFeed({
		announcements: announcementsFor(announcements, programmeIds).map((a) => ({ id: a.id, published_at: a.published_at, ...inReaderLocale(a, locals.locale) })),
		outcomes: applications.map((a) => {
			const id = idOf(APPLICATION, a);
			const outcome = outcomes[id];
			return { application_id: id, call: callTitle.get(String(a.call_id ?? '')) ?? '', decision: outcome?.decision ?? '', message: outcome?.message ?? '', decided_at: outcome?.decided_at ?? '' };
		}),
		reviews: myReviews.map((r) => ({ report_id: r.report_id, milestone: milestoneTitle.get(r.milestone_id) ?? '', decision: r.decision, message: r.message_to_startup, decided_at: r.decided_at })),
		sessions: sessions.filter((s) => booked.has(s.id)).map((s) => ({ id: s.id, title: s.title, starts_at: s.starts_at })),
		milestones,
		now: nowLocal(),
		today,
		seenAt
	});

	await locals.session.setData({ ...locals.session.data, updates_seen_at: nowUtc() });
	await locals.session.save();
	return feed;
};
