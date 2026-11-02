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
import { fail } from '@sveltejs/kit';
import { milestoneProgress, todayUtc } from '$lib/milestones';
import { nowUtc } from '$lib/screening';
import { attended, byStart, nowLocal } from '$lib/sessions';
import { CALL, MILESTONE_REPORT, PROGRAMME, SESSION_BOOKING } from '$lib/server/entities/definitions';
import { attendanceOfParticipants, bookingOf, seatsTaken, sessionsOfProgrammes } from '$lib/server/sessions';
import { messageOf } from '$lib/server/errors';
import { MAX_UPLOAD_BYTES, UPLOAD_MEDIA_TYPES, uploadRecordFile } from '$lib/server/files';
import { milestonesOf, reports, reviewsOfParticipants } from '$lib/server/milestones';
import { listForms, myAnswers } from '$lib/server/forms';
import { formTitle } from '$lib/forms';
import { participantsOfUser, registerCompany } from '$lib/server/participants';
import { createRecord, deleteRecord, getRecord, idOf, listRecords, userToken } from '$lib/server/records';
import type { Actions, PageServerLoad } from './$types';

/** The startup's place in each programme it was accepted into: stage, company and getting started. */
export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.session.data.user?.user_id ?? '';
	const participants = await participantsOfUser(userId);
	// The startup's own reports (/my/), and the reviews of them, read by Cohort narrowed to its own participants.
	const participantIds = participants.map((p) => p.id);
	const [myReports, myReviews, sessions, taken, myBookings, myAttendance, forms] = await Promise.all([
		reports('my', userToken(locals)!).catch(() => []),
		reviewsOfParticipants(participantIds),
		sessionsOfProgrammes(participants.map((p) => p.programme_id)),
		seatsTaken(),
		listRecords(SESSION_BOOKING, 'my', userToken(locals)!).then((r) => r.map(bookingOf)).catch(() => []),
		attendanceOfParticipants(participantIds),
		listForms().catch(() => [])
	]);
	const now = nowLocal();
	const today = todayUtc();
	const programmes = await Promise.all(
		participants.map(async (p) => {
			// The programme's surveys: open ones to answer, and closed ones this startup answered.
			const surveyForms = forms.filter((f) => f.purpose === 'survey' && f.programme_id === p.programme_id && f.status !== 'draft');
			const [programme, call, milestones, surveys] = await Promise.all([
				getRecord(PROGRAMME, 'public', p.programme_id).catch(() => null),
				p.call_id ? getRecord(CALL, 'public', p.call_id).catch(() => null) : Promise.resolve(null),
				milestonesOf(p.programme_id).catch(() => []),
				Promise.all(
					surveyForms.map(async (f) => {
						const mine = await myAnswers(f, p.id, userToken(locals)!).catch(() => null);
						return { id: f.id, title: formTitle(f, locals.locale), open: f.status === 'published', submitted_at: mine?.submitted_at ?? '' };
					})
				)
			]);
			return {
				...p,
				sessions: sessions
					.filter((s) => s.programme_id === p.programme_id)
					.sort(byStart)
					.map((s) => {
						const booking = myBookings.find((b) => b.session_id === s.id && b.participant_id === p.id);
						return {
							...s,
							upcoming: s.starts_at > now,
							seats_left: Math.max(0, s.capacity - (taken.get(s.id) ?? 0)),
							booking_id: booking?.id ?? null,
							attended: attended(s.id, p.id, myAttendance) ?? null
						};
					}),
				surveys: surveys.filter((s) => s.open || s.submitted_at),
				milestones: milestones.map((m) => {
					const progress = milestoneProgress(m, p.id, myReports, myReviews, today);
					return { ...m, status: progress.status, behind: progress.behind, message: progress.latestReview?.message_to_startup ?? '' };
				}),
				programme_name: String(programme?.name ?? ''),
				programme_starts_on: String(programme?.starts_on ?? ''),
				programme_ends_on: String(programme?.ends_on ?? ''),
				call_title: String(call?.title ?? '')
			};
		})
	);
	return { programmes, uploadAccept: Object.values(UPLOAD_MEDIA_TYPES).join(',') };
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export const actions: Actions = {
	/** Register the startup's company: a CORPORATE Customer, with the applicant linked to it. */
	company: async ({ locals, request }) => {
		const form = await request.formData();
		const details = { legal_name: str(form, 'legal_name'), mobile_phone_number: str(form, 'mobile_phone_number'), email: str(form, 'email') };
		if (!details.legal_name || !details.email || !details.mobile_phone_number) return fail(400, { error: 'company_missing' });
		try {
			await registerCompany(str(form, 'participant_id'), locals.session.data.user?.user_id ?? '', details);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { registered: true };
	},
	/** Book a seat at an upcoming session of the startup's programme: its own personal booking. */
	book: async ({ locals, request }) => {
		const token = userToken(locals)!;
		const form = await request.formData();
		const participant = (await participantsOfUser(locals.session.data.user?.user_id ?? '')).find((p) => p.id === str(form, 'participant_id'));
		if (!participant) return fail(400, { error: 'not_yours' });
		const session = (await sessionsOfProgrammes([participant.programme_id])).find((s) => s.id === str(form, 'session_id'));
		if (!session || session.starts_at <= nowLocal()) return fail(400, { error: 'session_closed' });
		const mine = (await listRecords(SESSION_BOOKING, 'my', token).catch(() => [])).map(bookingOf);
		if (mine.some((b) => b.session_id === session.id && b.participant_id === participant.id)) return { booked: true };
		const taken = (await seatsTaken()).get(session.id) ?? 0;
		if (taken >= session.capacity) return fail(400, { error: 'session_full' });
		try {
			await createRecord(SESSION_BOOKING, 'my', { session_id: session.id, participant_id: participant.id, startup_name: participant.startup_name, booked_at: nowUtc() }, token);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { booked: true };
	},
	/** Cancel one of the startup's own bookings, before the session starts. */
	cancel: async ({ locals, request }) => {
		const token = userToken(locals)!;
		const form = await request.formData();
		const booking = (await listRecords(SESSION_BOOKING, 'my', token).catch(() => [])).map(bookingOf).find((b) => b.id === str(form, 'booking_id'));
		if (!booking) return fail(400, { error: 'not_yours' });
		try {
			await deleteRecord(SESSION_BOOKING, 'my', booking.id, token);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { cancelled: true };
	},
	/** Report on a milestone: the startup's own record, with an optional evidence file attached to it. */
	report: async ({ locals, request }) => {
		const token = userToken(locals)!;
		const form = await request.formData();
		const participantId = str(form, 'participant_id');
		const milestoneId = str(form, 'milestone_id');
		const participant = (await participantsOfUser(locals.session.data.user?.user_id ?? '')).find((p) => p.id === participantId);
		if (!participant) return fail(400, { error: 'not_yours' });
		if (!(await milestonesOf(participant.programme_id)).some((m) => m.id === milestoneId)) return fail(400, { error: 'not_yours' });
		const file = form.get('file');
		const hasFile = file instanceof File && file.size > 0;
		if (hasFile && !(file.type in UPLOAD_MEDIA_TYPES)) return fail(400, { error: 'file_type' });
		if (hasFile && file.size > MAX_UPLOAD_BYTES) return fail(400, { error: 'file_size' });
		const note = str(form, 'note');
		if (!note && !hasFile) return fail(400, { error: 'report_empty' });
		try {
			const created = await createRecord(
				MILESTONE_REPORT,
				'my',
				{ milestone_id: milestoneId, participant_id: participantId, programme_id: participant.programme_id, ...(note ? { note } : {}), submitted_at: nowUtc() },
				token
			);
			if (hasFile) await uploadRecordFile(MILESTONE_REPORT, idOf(MILESTONE_REPORT, created), file, token);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { reported: true };
	}
};
