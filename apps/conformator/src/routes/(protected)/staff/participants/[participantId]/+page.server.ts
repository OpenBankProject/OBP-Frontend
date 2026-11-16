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
import { error, fail } from '@sveltejs/kit';
import { isOneOf, PARTICIPANT_STAGES } from '@obp/shared/conformator';
import { createRecord, getRecord, listRecords, userToken, type EntityRecord } from '$lib/server/records';
import { PARTICIPANT, PARTICIPANT_DECISION, PARTICIPANT_ENTITIES } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { fields } from '$lib/server/forms';
import { roleCheck } from '$lib/server/staffAccess';
import { bankExists } from '$lib/server/setupStatus';
import { addMember, participantSpaceEntities, setUpParticipantSpace } from '$lib/server/participantSpace';
import { centralSpace } from '$lib/server/space';
import { ROLE_SETS, type RoleSet } from '$lib/server/participantRoles';
import { currentStage, nextStages } from '$lib/participants';
import type { Actions, PageServerLoad } from './$types';

const GET_DECISIONS_ROLE = `CanGetDynamicEntityRecord_${PARTICIPANT_DECISION}`;
const DECIDE_ROLE = `CanCreateDynamicEntityRecord_${PARTICIPANT_DECISION}`;

async function participantOrError(id: string, token: string) {
	try {
		return (await getRecord(PARTICIPANT, id, token)).record;
	} catch (err) {
		error(404, `The participant could not be read: ${messageOf(err)}`);
	}
}

async function decisionsOf(participantId: string, token: string) {
	return (await listRecords(PARTICIPANT_DECISION, token))
		.filter((d) => d.record.participant_id === participantId)
		.map((d): EntityRecord => ({ ...d.record, created_at: d.metadata.created?.at ?? null, created_by: d.metadata.created?.user_id ?? null }))
		.sort((a, b) => String(b.decided_at || b.created_at).localeCompare(String(a.decided_at || a.created_at)));
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const token = userToken(locals)!;
	const [participant, can] = await Promise.all([participantOrError(params.participantId, token), roleCheck(token)]);
	const space = String(participant.space_id);
	const decisions = can(GET_DECISIONS_ROLE) ? await decisionsOf(params.participantId, token).catch(() => null) : null;
	const stage = decisions ? currentStage(decisions) : null;
	const [exists, entities] = await Promise.all([bankExists(space, token), participantSpaceEntities(space, token)]);
	return {
		participant,
		decisions,
		stage,
		nextStages: decisions ? nextStages(stage) : [],
		roleSets: Object.entries(ROLE_SETS).map(([key, value]) => ({ key, label: value.label })),
		participantSpace: {
			id: space,
			exists,
			entities: PARTICIPANT_ENTITIES.map((d) => ({ name: d.entity_name, ok: entities ? entities[d.entity_name] : null }))
		},
		can: {
			readDecisions: can(GET_DECISIONS_ROLE),
			decide: can(DECIDE_ROLE),
			createBank: can('CanCreateBank', ''),
			addMembers: can('CanCreateEntitlementAtOneBank', space) && can('CanGetAnyUser', '')
		},
		roles: { readDecisions: GET_DECISIONS_ROLE, decide: DECIDE_ROLE },
		space: centralSpace()
	};
};

export const actions: Actions = {
	decide: async ({ locals, params, request }) => {
		const token = userToken(locals)!;
		const { text, problems } = fields(await request.formData());
		const stageWanted = text('stage', 'The stage', { required: true });
		const reason = text('reason', 'The reason', { required: true, max: 4000 });
		const stage = currentStage(await decisionsOf(params.participantId, token));
		if (!isOneOf(PARTICIPANT_STAGES, stageWanted) || !nextStages(stage).includes(stageWanted))
			problems.push(`A participant cannot move to ${stageWanted.replaceAll('_', ' ') || 'that stage'} from ${stage ?? 'not admitted'}.`);
		if (problems.length) return fail(400, { problems, values: { stage: stageWanted, reason } });
		try {
			await createRecord(
				PARTICIPANT_DECISION,
				{ participant_id: params.participantId, stage: stageWanted, reason, decided_at: new Date().toISOString() },
				token
			);
		} catch (err) {
			return fail(400, { problems: [messageOf(err)], values: { stage: stageWanted, reason } });
		}
		return { decided: stageWanted };
	},

	addMember: async ({ locals, params, request }) => {
		const token = userToken(locals)!;
		const participant = await participantOrError(params.participantId, token);
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const set = String(form.get('role_set') ?? '');
		if (!username) return fail(400, { memberProblems: ['Give the username of the person to add.'] });
		if (!(set in ROLE_SETS)) return fail(400, { memberProblems: ['Choose what the person will do.'] });
		return { memberSteps: await addMember(String(participant.space_id), username, set as RoleSet, token), member: username };
	},

	setUpSpace: async ({ locals, params }) => {
		const token = userToken(locals)!;
		const participant = await participantOrError(params.participantId, token);
		try {
			const steps = await setUpParticipantSpace(String(participant.space_id), String(participant.legal_name), token);
			return { steps };
		} catch (err) {
			return fail(400, { problems: [messageOf(err)] });
		}
	}
};
