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
import { error, fail } from '@sveltejs/kit';
import { nowUtc } from '$lib/screening';
import { attended, byStart, nowLocal, SESSION_KINDS } from '$lib/sessions';
import { ATTENDANCE, PARTICIPANT, PROGRAMME, SESSION, SESSION_BOOKING } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { participantOf } from '$lib/server/participants';
import { createRecord, getRecord, listRecords, userToken } from '$lib/server/records';
import { attendanceOf, bookingOf, sessionsFromRecords } from '$lib/server/sessions';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole, write } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const ROLES = {
	create: `CanCreateDynamicEntityRecord_${SESSION}`,
	read: `CanGetDynamicEntityRecord_${SESSION}`,
	bookings: `CanGetDynamicEntityRecord_${SESSION_BOOKING}`,
	participants: `CanGetDynamicEntityRecord_${PARTICIPANT}`,
	attendance: `CanCreateDynamicEntityRecord_${ATTENDANCE}`,
	readAttendance: `CanGetDynamicEntityRecord_${ATTENDANCE}`
};

/** A programme's sessions, who booked each and who attended, read with the staff member's own Roles. */
export const load: PageServerLoad = async ({ params, locals }) => {
	const token = userToken(locals)!;
	const programme = await getRecord(PROGRAMME, 'public', params.id).catch(() => error(404, 'Programme not found'));
	const [sessions, bookings, attendance, participants, access] = await Promise.allSettled([
		listRecords(SESSION, '', token),
		listRecords(SESSION_BOOKING, 'community', token),
		listRecords(ATTENDANCE, '', token),
		listRecords(PARTICIPANT, '', token),
		staffAccess(token)
	]);
	const roles = access.status === 'fulfilled' ? access.value.roles : [];
	const lacking = Object.fromEntries(Object.entries(ROLES).map(([k, name]) => [k, roles.find((r) => r.role_name === name && !r.held) ?? null]));
	const bookingList = bookings.status === 'fulfilled' ? bookings.value.map(bookingOf) : [];
	const attendanceList = attendance.status === 'fulfilled' ? attendance.value.map(attendanceOf) : [];
	const startups = (participants.status === 'fulfilled' ? participants.value.map(participantOf) : [])
		.filter((p) => p.programme_id === params.id && p.status === 'active')
		.map((p) => ({ id: p.id, startup_name: p.startup_name }));
	const now = nowLocal();
	const list = (sessions.status === 'fulfilled' ? sessionsFromRecords(sessions.value) : [])
		.filter((s) => s.programme_id === params.id)
		.sort(byStart)
		.map((s) => {
			const booked = bookingList.filter((b) => b.session_id === s.id);
			return {
				...s,
				started: s.starts_at <= now,
				booked: booked.map((b) => ({ participant_id: b.participant_id, startup_name: b.startup_name })),
				// Those expected: the startups that booked, or for a workshop or demo day with no bookings, everyone.
				roll: (booked.length ? booked.map((b) => ({ id: b.participant_id, startup_name: b.startup_name })) : s.kind === 'mentoring' ? [] : startups).map((p) => ({
					...p,
					attended: attended(s.id, p.id, attendanceList) ?? null
				}))
			};
		});
	return {
		programme: { id: params.id, name: String(programme.name ?? '') },
		sessions: list,
		lacking,
		error: sessions.status === 'rejected' && !lacking.read ? messageOf(sessions.reason) : null,
		space: access.status === 'fulfilled' ? access.value.space : '',
		entitlementRequestsUrl: access.status === 'fulfilled' ? access.value.entitlementRequestsUrl : null
	};
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export const actions: Actions = {
	createSession: async ({ params, locals, request }) => {
		const form = await request.formData();
		const title = str(form, 'title');
		const kind = str(form, 'kind');
		const startsAt = str(form, 'starts_at');
		const capacity = Math.trunc(Number(str(form, 'capacity') || '1'));
		const duration = Math.trunc(Number(str(form, 'duration_minutes') || '60'));
		if (!title || !(SESSION_KINDS as readonly string[]).includes(kind) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAt) || !(capacity >= 1) || !(duration >= 5)) {
			return fail(400, { form: 'session', error: 'invalid' });
		}
		const record = {
			programme_id: params.id,
			title,
			kind,
			starts_at: startsAt,
			duration_minutes: duration,
			capacity,
			...(str(form, 'location') ? { location: str(form, 'location') } : {}),
			...(str(form, 'mentor_name') ? { mentor_name: str(form, 'mentor_name') } : {})
		};
		return write('session', () => createRecord(SESSION, '', record, userToken(locals)!), { created: true });
	},
	/** Record who attended: one append-only record for each startup on the roll, attended or not. */
	attendance: async ({ locals, request }) => {
		const token = userToken(locals)!;
		const form = await request.formData();
		const sessionId = str(form, 'session_id');
		const roll = form.getAll('roll').map(String);
		const present = new Set(form.getAll('attended').map(String));
		if (!sessionId || roll.length === 0) return fail(400, { form: 'attendance', error: 'invalid' });
		const username = locals.session.data.user?.username ?? '';
		return write(
			'attendance',
			async () => {
				for (const participantId of roll) {
					await createRecord(
						ATTENDANCE,
						'',
						{ session_id: sessionId, participant_id: participantId, attended: present.has(participantId), recorded_by_username: username, recorded_at: nowUtc() },
						token
					);
				}
			},
			{ recorded: true }
		);
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
