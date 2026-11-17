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
import { stageName, stagesOf } from '$lib/stages';
import { CALL, MILESTONE_REPORT, PROGRAMME, SESSION_BOOKING } from '$lib/server/entities/definitions';
import { attendanceOfParticipants, bookingOf, bookingsOfParticipants, seatsTaken, sessionsOfProgrammes } from '$lib/server/sessions';
import { messageOf } from '$lib/server/errors';
import { MAX_UPLOAD_BYTES, UPLOAD_MEDIA_TYPES, uploadRecordFile } from '$lib/server/files';
import { milestonesOf, reportsOfParticipants, reviewsOfParticipants } from '$lib/server/milestones';
import { listForms, teamAnswers } from '$lib/server/forms';
import { announcementsFor } from '$lib/announcements';
import { allAnnouncements } from '$lib/server/announcements';
import { allSlots, feedbackOfParticipants } from '$lib/server/demoDay';
import { formTitle } from '$lib/forms';
import { myOrganisationsOrNone, participantsOfUser, recordTeam, registerCompany } from '$lib/server/participants';
import { addTeamMember, changeTeamMemberRole, createTeam, removeTeamMember, teamMembers } from '$lib/server/teams';
import { isMemberRole, type OrganisationMember } from '$lib/teams';
import { createRecord, deleteRecord, getRecord, idOf, listRecords, userToken } from '$lib/server/records';
import type { Actions, PageServerLoad } from './$types';

/** The startup's place in each programme it was accepted into: stage, team, company and getting started. */
export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.session.data.user?.user_id ?? '';
	const token = userToken(locals)!;
	const [participants, organisations] = await Promise.all([participantsOfUser(userId, token), myOrganisationsOrNone(token)]);
	// The team's reports and bookings, and the reviews of the reports, read by Cohort narrowed to its own participants.
	// The User's own bookings (/my/) are the ones they may cancel.
	const participantIds = participants.map((p) => p.id);
	const [myReports, myReviews, sessions, taken, teamBookings, myBookingIds, myAttendance, forms, announcements, demoSlots, pitchFeedback] = await Promise.all([
		reportsOfParticipants(participantIds),
		reviewsOfParticipants(participantIds),
		sessionsOfProgrammes(participants.map((p) => p.programme_id)),
		seatsTaken(),
		bookingsOfParticipants(participantIds),
		listRecords(SESSION_BOOKING, 'my', token).then((r) => new Set(r.map((record) => bookingOf(record).id))).catch(() => new Set<string>()),
		attendanceOfParticipants(participantIds),
		listForms().catch(() => []),
		allAnnouncements(),
		allSlots(),
		feedbackOfParticipants(participantIds)
	]);
	// Each team's members, read by the User as a member of it.
	const teamIds = [...new Set(participants.map((p) => p.organisation_id).filter(Boolean))];
	const membersByTeam = new Map<string, OrganisationMember[] | null>(
		await Promise.all(teamIds.map(async (organisationId) => [organisationId, await teamMembers(organisationId, token).catch(() => null)] as const))
	);
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
						const team = await teamAnswers(f, p.id, userToken(locals)!).catch(() => null);
						return { id: f.id, title: formTitle(f, locals.locale), open: f.status === 'published', submitted_at: team?.submitted_at ?? '' };
					})
				)
			]);
			const team = organisations.find((organisation) => organisation.organisation_id === p.organisation_id);
			return {
				...p,
				team: p.organisation_id
					? { name: team?.name ?? '', my_role: team?.member_role ?? 'member', members: membersByTeam.get(p.organisation_id) ?? null }
					: null,
				// Only the applicant chooses the team: a new one, or one of Cohort's space they are an admin of.
				can_choose_team: !p.organisation_id && p.user_id === userId,
				sessions: sessions
					.filter((s) => s.programme_id === p.programme_id)
					.sort(byStart)
					.map((s) => {
						const booking = teamBookings.find((b) => b.session_id === s.id && b.participant_id === p.id);
						return {
							...s,
							upcoming: s.starts_at > now,
							seats_left: Math.max(0, s.capacity - (taken.get(s.id) ?? 0)),
							booked: Boolean(booking),
							// A booking is a personal record, so only the team member who made it can cancel it.
							booking_id: booking && myBookingIds.has(booking.id) ? booking.id : null,
							attended: attended(s.id, p.id, myAttendance) ?? null
						};
					}),
				surveys: surveys.filter((s) => s.open || s.submitted_at),
				milestones: milestones.map((m) => {
					const progress = milestoneProgress(m, p.id, myReports, myReviews, today);
					return { ...m, status: progress.status, behind: progress.behind, message: progress.latestReview?.message_to_startup ?? '' };
				}),
				programme_name: String(programme?.name ?? ''),
				stage_name: stageName(locals.locale, p.stage, stagesOf(programme)),
				// Its pitch slots on demo days, with the session's title and time, and the feedback on its pitches.
				demo_slots: demoSlots
					.filter((slot) => slot.participant_id === p.id)
					.map((slot) => ({ ...slot, session: sessions.find((s) => s.id === slot.session_id) }))
					.filter((slot) => slot.session)
					.map((slot) => ({ id: slot.id, session_id: slot.session_id, title: slot.session!.title, date: slot.session!.starts_at.slice(0, 10), starts_at: slot.starts_at, position: slot.position })),
				pitch_feedback: pitchFeedback.filter((f) => f.participant_id === p.id).map((f) => ({ id: f.id, feedback: f.feedback, given_at: f.given_at })),
				programme_starts_on: String(programme?.starts_on ?? ''),
				programme_ends_on: String(programme?.ends_on ?? ''),
				call_title: String(call?.title ?? '')
			};
		})
	);
	return {
		programmes,
		userId,
		// Only teams the User is an admin of, so they can manage who sees the programme.
		teamsToChoose: organisations.filter((organisation) => organisation.status === 'active' && organisation.member_role === 'admin').map((organisation) => ({ organisation_id: organisation.organisation_id, name: organisation.name })),
		announcements: participants.length ? announcementsFor(announcements, participants.map((p) => p.programme_id)).slice(0, 10) : [],
		uploadAccept: Object.values(UPLOAD_MEDIA_TYPES).join(',')
	};
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

/**
 * The team of one of the User's participations, for a change to it. OBP-API checks that the User is an admin (or, to
 * leave, the member themselves); this only makes sure the team is one the User sees in Cohort.
 */
async function teamOfParticipant(locals: App.Locals, participantId: string): Promise<string | null> {
	const participant = (await participantsOfUser(locals.session.data.user?.user_id ?? '', userToken(locals)!)).find((p) => p.id === participantId);
	return participant?.organisation_id || null;
}

export const actions: Actions = {
	/** Register the startup's company: a CORPORATE Customer, with the applicant linked to it. */
	company: async ({ locals, request }) => {
		const form = await request.formData();
		const details = { legal_name: str(form, 'legal_name'), mobile_phone_number: str(form, 'mobile_phone_number'), email: str(form, 'email') };
		if (!details.legal_name || !details.email || !details.mobile_phone_number) return fail(400, { error: 'company_missing' });
		try {
			await registerCompany(str(form, 'participant_id'), locals.session.data.user?.user_id ?? '', userToken(locals)!, details);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { registered: true };
	},
	/** Choose the startup's team: a new Organisation, with the applicant as its admin, or one they are already an admin of. */
	team: async ({ locals, request }) => {
		const token = userToken(locals)!;
		const form = await request.formData();
		const participantId = str(form, 'participant_id');
		const userId = locals.session.data.user?.user_id ?? '';
		const name = str(form, 'name');
		let organisationId = str(form, 'organisation_id');
		if (!organisationId && !name) return fail(400, { error: 'team_missing' });
		try {
			if (!organisationId) organisationId = await createTeam(token, { name, website: str(form, 'website') });
			await recordTeam(participantId, userId, token, organisationId);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { teamChosen: true };
	},
	/** Add a person to the startup's team by their OBP user_id. */
	addMember: async ({ locals, request }) => {
		const form = await request.formData();
		const organisationId = await teamOfParticipant(locals, str(form, 'participant_id'));
		const memberUserId = str(form, 'user_id');
		const memberRole = str(form, 'member_role');
		if (!organisationId) return fail(400, { error: 'not_yours' });
		if (!memberUserId || !isMemberRole(memberRole)) return fail(400, { error: 'member_missing' });
		try {
			await addTeamMember(organisationId, memberUserId, memberRole, userToken(locals)!);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { memberAdded: true };
	},
	/** Make a team member an admin, or an admin a member. */
	memberRole: async ({ locals, request }) => {
		const form = await request.formData();
		const organisationId = await teamOfParticipant(locals, str(form, 'participant_id'));
		const memberRole = str(form, 'member_role');
		if (!organisationId) return fail(400, { error: 'not_yours' });
		if (!isMemberRole(memberRole)) return fail(400, { error: 'member_missing' });
		try {
			await changeTeamMemberRole(organisationId, str(form, 'user_id'), memberRole, userToken(locals)!);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { memberChanged: true };
	},
	/** Remove someone from the team, or leave it. */
	removeMember: async ({ locals, request }) => {
		const form = await request.formData();
		const organisationId = await teamOfParticipant(locals, str(form, 'participant_id'));
		if (!organisationId) return fail(400, { error: 'not_yours' });
		const memberUserId = str(form, 'user_id');
		try {
			await removeTeamMember(organisationId, memberUserId, userToken(locals)!);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return memberUserId === locals.session.data.user?.user_id ? { left: true } : { memberRemoved: true };
	},
	/** Book a seat at an upcoming session of the startup's programme: a personal booking of the team member. */
	book: async ({ locals, request }) => {
		const token = userToken(locals)!;
		const form = await request.formData();
		const participant = (await participantsOfUser(locals.session.data.user?.user_id ?? '', token)).find((p) => p.id === str(form, 'participant_id'));
		if (!participant) return fail(400, { error: 'not_yours' });
		const session = (await sessionsOfProgrammes([participant.programme_id])).find((s) => s.id === str(form, 'session_id'));
		if (!session || session.starts_at <= nowLocal()) return fail(400, { error: 'session_closed' });
		// One seat per startup: someone in the team may have booked already.
		const teamBookings = await bookingsOfParticipants([participant.id]);
		if (teamBookings.some((b) => b.session_id === session.id)) return { booked: true };
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
		const participant = (await participantsOfUser(locals.session.data.user?.user_id ?? '', token)).find((p) => p.id === participantId);
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
