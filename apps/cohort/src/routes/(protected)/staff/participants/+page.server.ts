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
import { participantProgress } from '$lib/dashboard';
import { milestoneOf, todayUtc } from '$lib/milestones';
import { nowUtc } from '$lib/screening';
import { nextStage } from '$lib/stages';
import { CALL, MILESTONE, MILESTONE_REPORT, MILESTONE_REVIEW, PARTICIPANT, PROGRAMME, STAGE_CHANGE } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { reports, reviewsForStaff } from '$lib/server/milestones';
import { participantOf } from '$lib/server/participants';
import { createRecord, idOf, listRecords, updateRecord, userToken, type CohortRecord } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole, write } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const ROLES = {
	read: `CanGetDynamicEntityRecord_${PARTICIPANT}`,
	reports: `CanGetDynamicEntityRecord_${MILESTONE_REPORT}`,
	reviews: `CanGetDynamicEntityRecord_${MILESTONE_REVIEW}`,
	advance: `CanUpdateDynamicEntityRecord_${PARTICIPANT}`,
	history: `CanCreateDynamicEntityRecord_${STAGE_CHANGE}`
};

/** Each participant with its progress and the gate to its next stage, read with the staff member's own Roles. */
async function participantsWithGates(token: string) {
	const [records, programmes, calls, milestones, reportList, reviewList] = await Promise.all([
		listRecords(PARTICIPANT, '', token),
		listRecords(PROGRAMME, 'public').catch(() => []),
		listRecords(CALL, 'public').catch(() => []),
		listRecords(MILESTONE, 'public').catch(() => []),
		reports('community', token).catch(() => []),
		reviewsForStaff(token).catch(() => [])
	]);
	const programmeName = new Map(programmes.map((p) => [idOf(PROGRAMME, p), String(p.name ?? '')]));
	const callTitle = new Map(calls.map((c) => [idOf(CALL, c), String(c.title ?? '')]));
	const ms = milestones.map((m) => milestoneOf(idOf(MILESTONE, m), m));
	const today = todayUtc();
	return records.map((record) => {
		const p = participantOf(record);
		const progress = participantProgress(p, programmeName.get(p.programme_id) ?? '', ms, reportList, reviewList, today);
		return {
			record,
			row: {
				...p,
				programme: programmeName.get(p.programme_id) ?? '',
				call: callTitle.get(p.call_id) ?? '',
				milestones_accepted: progress.milestones_accepted,
				milestones_total: progress.milestones_total,
				next: nextStage(progress)
			}
		};
	});
}

export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const access = await staffAccess(token).catch(() => null);
	const roles = access?.roles ?? [];
	const lacking = Object.fromEntries(Object.entries(ROLES).map(([k, name]) => [k, roles.find((r) => r.role_name === name && !r.held) ?? null]));
	const base = { space: access?.space ?? '', entitlementRequestsUrl: access?.entitlementRequestsUrl ?? null, lacking };
	if (lacking.read) return { ...base, participants: [], error: null };
	try {
		const participants = (await participantsWithGates(token)).map((p) => p.row).sort((a, b) => b.joined_at.localeCompare(a.joined_at));
		return { ...base, participants, error: null };
	} catch (err) {
		return { ...base, participants: [], error: messageOf(err) };
	}
};

export const actions: Actions = {
	/** Move a startup to its next stage, if its gate is met: the participant is updated and the move recorded. */
	advance: async ({ locals, request }) => {
		const token = userToken(locals)!;
		const form = await request.formData();
		const participantId = String(form.get('participant_id') ?? '');
		const found = (await participantsWithGates(token).catch(() => [])).find((p) => p.row.id === participantId);
		if (!found) return fail(400, { form: 'advance', error: 'invalid' });
		const { record, row } = found;
		if (!row.next.to || row.next.missing) return fail(400, { form: 'advance', error: 'gate' });
		const to = row.next.to;
		const now = nowUtc();
		const updated: CohortRecord = Object.fromEntries(
			Object.entries({
				...record,
				stage: to,
				...(to === 'graduated' ? { status: 'graduated', graduated_at: now } : {})
			}).filter(([key, value]) => key !== `${PARTICIPANT}_id` && value !== '' && value !== null && value !== undefined)
		);
		const note = String(form.get('note') ?? '').trim();
		return write(
			'advance',
			async () => {
				await updateRecord(PARTICIPANT, '', participantId, updated, token);
				await createRecord(
					STAGE_CHANGE,
					'',
					{
						participant_id: participantId,
						programme_id: row.programme_id,
						from_stage: row.stage,
						to_stage: to,
						...(note ? { note } : {}),
						changed_by_username: locals.session.data.user?.username ?? '',
						changed_at: now
					},
					token
				);
			},
			{ advanced: to }
		);
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
