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
import { demoGuestOf, GUEST_STATUSES, nextPosition, pitchFeedbackOf } from '$lib/demoDay';
import { nowUtc } from '$lib/screening';
import { slotsOf } from '$lib/server/demoDay';
import { DEMO_GUEST, DEMO_SLOT, PARTICIPANT, PITCH_FEEDBACK, PROGRAMME, SESSION } from '$lib/server/entities/definitions';
import { participantOf } from '$lib/server/participants';
import { createRecord, deleteRecord, getRecord, idOf, listRecords, updateRecord, userToken } from '$lib/server/records';
import { sessionsFromRecords } from '$lib/server/sessions';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole, write } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const ROLES = {
	slots: `CanCreateDynamicEntityRecord_${DEMO_SLOT}`,
	removeSlot: `CanDeleteDynamicEntityRecord_${DEMO_SLOT}`,
	guests: `CanGetDynamicEntityRecord_${DEMO_GUEST}`,
	invite: `CanCreateDynamicEntityRecord_${DEMO_GUEST}`,
	guestStatus: `CanUpdateDynamicEntityRecord_${DEMO_GUEST}`,
	feedback: `CanGetDynamicEntityRecord_${PITCH_FEEDBACK}`,
	giveFeedback: `CanCreateDynamicEntityRecord_${PITCH_FEEDBACK}`
};

/** A demo day: its running order, guests and pitch feedback, managed with the staff member's own Roles. */
export const load: PageServerLoad = async ({ params, locals }) => {
	const token = userToken(locals)!;
	const [programme, sessionRecord, access] = await Promise.all([
		getRecord(PROGRAMME, 'public', params.id).catch(() => null),
		getRecord(SESSION, '', params.sessionId, token).catch(() => null),
		staffAccess(token).catch(() => null)
	]);
	const session = sessionRecord ? sessionsFromRecords([sessionRecord])[0] : undefined;
	if (!programme || !session || session.programme_id !== params.id || session.kind !== 'demo_day') error(404, 'Demo day not found');
	const roles = access?.roles ?? [];
	const lacking = Object.fromEntries(Object.entries(ROLES).map(([k, name]) => [k, roles.find((r) => r.role_name === name && !r.held) ?? null]));
	const [slots, guests, feedback, participants] = await Promise.all([
		slotsOf(params.sessionId),
		lacking.guests ? Promise.resolve([]) : listRecords(DEMO_GUEST, '', token).catch(() => []),
		lacking.feedback ? Promise.resolve([]) : listRecords(PITCH_FEEDBACK, '', token).catch(() => []),
		listRecords(PARTICIPANT, '', token).catch(() => [])
	]);
	return {
		programme: { id: params.id, name: String(programme.name ?? '') },
		session,
		slots,
		guests: guests.map((g) => demoGuestOf(idOf(DEMO_GUEST, g), g)).filter((g) => g.session_id === params.sessionId),
		feedback: feedback.map((f) => pitchFeedbackOf(idOf(PITCH_FEEDBACK, f), f)).filter((f) => f.session_id === params.sessionId),
		startups: participants.map(participantOf).filter((p) => p.programme_id === params.id && p.status !== 'withdrawn').map((p) => ({ id: p.id, startup_name: p.startup_name })),
		lacking,
		space: access?.space ?? '',
		entitlementRequestsUrl: access?.entitlementRequestsUrl ?? null
	};
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export const actions: Actions = {
	/** Put a startup in the running order, after the last. */
	addSlot: async ({ params, locals, request }) => {
		const form = await request.formData();
		const token = userToken(locals)!;
		const participant = (await listRecords(PARTICIPANT, '', token).catch(() => [])).map(participantOf).find((p) => p.id === str(form, 'participant_id') && p.programme_id === params.id);
		const startsAt = str(form, 'starts_at');
		if (!participant || (startsAt && !/^\d{2}:\d{2}$/.test(startsAt))) return fail(400, { form: 'slot', error: 'demo_slot_invalid' });
		const slots = await slotsOf(params.sessionId);
		if (slots.some((s) => s.participant_id === participant.id)) return fail(400, { form: 'slot', error: 'demo_slot_taken' });
		const record = { session_id: params.sessionId, participant_id: participant.id, startup_name: participant.startup_name, position: nextPosition(slots), starts_at: startsAt, pitch_title: str(form, 'pitch_title').slice(0, 255) };
		return write('slot', () => createRecord(DEMO_SLOT, '', Object.fromEntries(Object.entries(record).filter(([, v]) => v !== '')), token), { added: true });
	},
	removeSlot: async ({ locals, request }) => {
		const id = str(await request.formData(), 'slot_id');
		return write('slot', () => deleteRecord(DEMO_SLOT, '', id, userToken(locals)!), { removed: true });
	},
	/** Record a guest invited to the demo day. */
	invite: async ({ params, locals, request }) => {
		const form = await request.formData();
		const name = str(form, 'name');
		if (!name) return fail(400, { form: 'guest', error: 'demo_guest_missing' });
		const record = {
			session_id: params.sessionId,
			name: name.slice(0, 255),
			organisation: str(form, 'organisation').slice(0, 255),
			email: str(form, 'email').slice(0, 255),
			status: 'invited',
			invited_by_username: locals.session.data.user?.username ?? '',
			invited_at: nowUtc()
		};
		return write('guest', () => createRecord(DEMO_GUEST, '', Object.fromEntries(Object.entries(record).filter(([, v]) => v !== '')), userToken(locals)!), { invited: true });
	},
	/** A guest confirmed or declined: the record is replaced with its new status. */
	guestStatus: async ({ locals, request }) => {
		const form = await request.formData();
		const token = userToken(locals)!;
		const status = str(form, 'status');
		const record = await getRecord(DEMO_GUEST, '', str(form, 'guest_id'), token).catch(() => null);
		if (!record || !(GUEST_STATUSES as readonly string[]).includes(status)) return fail(400, { form: 'guest', error: 'demo_guest_missing' });
		const body = Object.fromEntries(Object.entries({ ...record, status }).filter(([k, v]) => k !== `${DEMO_GUEST}_id` && v !== '' && v !== null && v !== undefined));
		return write('guest', () => updateRecord(DEMO_GUEST, '', str(form, 'guest_id'), body, token), { updated: true });
	},
	/** Feedback on a startup's pitch, which the startup then sees on its programme page. */
	feedback: async ({ params, locals, request }) => {
		const form = await request.formData();
		const feedback = str(form, 'feedback').slice(0, 4000);
		const participantId = str(form, 'participant_id');
		if (!feedback || !participantId) return fail(400, { form: 'feedback', error: 'demo_feedback_missing' });
		const record = { session_id: params.sessionId, participant_id: participantId, feedback, given_by_username: locals.session.data.user?.username ?? '', given_at: nowUtc() };
		return write('feedback', () => createRecord(PITCH_FEEDBACK, '', record, userToken(locals)!), { given: true });
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
