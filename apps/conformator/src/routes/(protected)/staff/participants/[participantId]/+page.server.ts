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
import { createRecord, fieldsOf, getRecord, listRecords, updateRecord, userToken, type EntityRecord } from '$lib/server/records';
import { PARTICIPANT, PARTICIPANT_DECISION, PARTICIPANT_ENTITIES } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { fields } from '$lib/server/forms';
import { roleCheck } from '$lib/server/staffAccess';
import { bankExists } from '$lib/server/setupStatus';
import {
	ACCESS_SPACE_ROLE,
	addRegulatorPerson,
	bringAccessInLine,
	participantSpaceEntities,
	participantSpaceReady,
	readOrganisationAccess,
	setUpParticipantSpace,
	type SpaceStep
} from '$lib/server/participantSpace';
import { centralSpace } from '$lib/server/space';
import { REGULATOR_ROLE_SETS, ROLE_SETS, type RegulatorRoleSet } from '$lib/server/participantRoles';
import {
	CREATE_ORGANISATION_ROLE,
	createOrganisation,
	GET_ORGANISATION_ROLE,
	getOrganisation,
	organisationMembers,
	userIdByUsername,
	type Organisation
} from '$lib/server/organisations';
import { ACTIVE_STATUS, type OrganisationMember } from '$lib/server/organisationAccess';
import { currentStage, nextStages } from '$lib/participants';
import type { Actions, PageServerLoad } from './$types';

const GET_DECISIONS_ROLE = `CanGetDynamicEntityRecord_${PARTICIPANT_DECISION}`;
const DECIDE_ROLE = `CanCreateDynamicEntityRecord_${PARTICIPANT_DECISION}`;
const UPDATE_PARTICIPANT_ROLE = `CanUpdateDynamicEntityRecord_${PARTICIPANT}`;

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

/** The participant's Organisation, its members and how far the space's access is from them, or why they cannot be read. */
async function organisationOf(organisationId: string, space: string, spaceReady: boolean, canReadAccess: boolean, token: string) {
	let organisation: Organisation;
	let members: OrganisationMember[];
	try {
		[organisation, members] = await Promise.all([getOrganisation(organisationId, token), organisationMembers(organisationId, token)]);
	} catch (err) {
		return { organisation: null, members: null, membersHaveAccess: null, plan: null, problem: messageOf(err) };
	}
	const shown = {
		organisation,
		members: members.map((m) => ({ user_id: m.user_id, username: m.username, member_role: m.member_role })),
		membersHaveAccess: organisation.status === ACTIVE_STATUS
	};
	if (!spaceReady || !canReadAccess) return { ...shown, plan: null, problem: null };
	try {
		const access = await readOrganisationAccess(space, organisationId, token);
		const plan = {
			toGrant: new Set(access.grant.map((g) => g.user_id)).size,
			toRemove: new Set(access.remove.map((r) => r.user_id)).size
		};
		return { ...shown, plan, problem: null };
	} catch (err) {
		return { ...shown, plan: null, problem: messageOf(err) };
	}
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const token = userToken(locals)!;
	const [participant, can] = await Promise.all([participantOrError(params.participantId, token), roleCheck(token)]);
	const space = String(participant.space_id);
	const organisationId = String(participant.organisation_id ?? '');
	const decisions = can(GET_DECISIONS_ROLE) ? await decisionsOf(params.participantId, token).catch(() => null) : null;
	const stage = decisions ? currentStage(decisions) : null;
	const [exists, entities] = await Promise.all([bankExists(space, token), participantSpaceEntities(space, token)]);
	const spaceReady = exists === true && entities !== null && Object.values(entities).every(Boolean);
	const canReadOrganisation = can(GET_ORGANISATION_ROLE);
	// Reading who holds which Role at the space needs CanGetEntitlementsForOneBank there, which setting it up, or
	// bringing access in line, grants.
	const canReadAccess = canReadOrganisation && can('CanGetEntitlementsForOneBank', space);
	const organisation = organisationId && canReadOrganisation ? await organisationOf(organisationId, space, spaceReady, canReadAccess, token) : null;
	return {
		participant,
		decisions,
		stage,
		nextStages: decisions ? nextStages(stage) : [],
		regulatorRoleSets: REGULATOR_ROLE_SETS.map((key) => ({ key, label: ROLE_SETS[key].label })),
		participantSpace: {
			id: space,
			exists,
			entities: PARTICIPANT_ENTITIES.map((d) => ({ name: d.entity_name, ok: entities ? entities[d.entity_name] : null }))
		},
		organisationId,
		organisation,
		can: {
			readDecisions: can(GET_DECISIONS_ROLE),
			decide: can(DECIDE_ROLE),
			createBank: can('CanCreateBank', ''),
			readOrganisation: canReadOrganisation,
			createOrganisation: can(CREATE_ORGANISATION_ROLE) && can('CanGetAnyUser', '') && can(UPDATE_PARTICIPANT_ROLE),
			linkOrganisation: canReadOrganisation && can(UPDATE_PARTICIPANT_ROLE),
			bringAccessInLine: canReadOrganisation && can(ACCESS_SPACE_ROLE, space),
			addRegulatorPeople: can('CanCreateEntitlementAtOneBank', space) && can('CanGetAnyUser', '')
		},
		roles: {
			readDecisions: GET_DECISIONS_ROLE,
			decide: DECIDE_ROLE,
			readOrganisation: GET_ORGANISATION_ROLE,
			createOrganisation: [CREATE_ORGANISATION_ROLE, UPDATE_PARTICIPANT_ROLE],
			accessAtSpace: ACCESS_SPACE_ROLE
		},
		space: centralSpace()
	};
};

/** Record the Organisation on the participant, then bring the space's access in line with it if the space is ready. */
async function linkAndBringInLine(participant: EntityRecord, participantId: string, organisationId: string, token: string): Promise<SpaceStep[]> {
	const steps: SpaceStep[] = [];
	try {
		await updateRecord(PARTICIPANT, participantId, { ...fieldsOf(PARTICIPANT, participant), organisation_id: organisationId }, token);
		steps.push({ step: `Link ${participant.legal_name} to the Organisation ${organisationId}`, ok: true });
	} catch (err) {
		steps.push({ step: `Link ${participant.legal_name} to the Organisation ${organisationId}`, ok: false, detail: messageOf(err) });
		return steps;
	}
	const space = String(participant.space_id);
	if (await participantSpaceReady(space, token)) steps.push(...(await bringAccessInLine(space, organisationId, token)));
	else steps.push({ step: "Give the Organisation's members access", ok: true, detail: 'This happens once the space is set up.' });
	return steps;
}

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

	createOrganisation: async ({ locals, params, request }) => {
		const token = userToken(locals)!;
		const participant = await participantOrError(params.participantId, token);
		if (participant.organisation_id) return fail(400, { organisationProblems: ['This participant already has an Organisation.'] });
		const username = String((await request.formData()).get('admin_username') ?? '').trim();
		if (!username) return fail(400, { organisationProblems: ["Give the username of the Organisation's first admin."] });
		let adminUserId: string;
		try {
			adminUserId = await userIdByUsername(username, token);
		} catch (err) {
			return fail(400, { organisationProblems: [`The User ${username} could not be found: ${messageOf(err)}`] });
		}
		let organisation: Organisation;
		try {
			organisation = await createOrganisation(String(participant.legal_name), adminUserId, token);
		} catch (err) {
			return fail(400, { organisationProblems: [messageOf(err)] });
		}
		const steps: SpaceStep[] = [{ step: `Create the Organisation ${organisation.name} with ${username} as its first admin`, ok: true }];
		steps.push(...(await linkAndBringInLine(participant, params.participantId, organisation.organisation_id, token)));
		return { organisationSteps: steps };
	},

	linkOrganisation: async ({ locals, params, request }) => {
		const token = userToken(locals)!;
		const participant = await participantOrError(params.participantId, token);
		if (participant.organisation_id) return fail(400, { organisationProblems: ['This participant already has an Organisation.'] });
		const organisationId = String((await request.formData()).get('organisation_id') ?? '').trim();
		if (!organisationId) return fail(400, { organisationProblems: ['Give the organisation_id of the Organisation.'] });
		try {
			await getOrganisation(organisationId, token);
		} catch (err) {
			return fail(400, { organisationProblems: [`The Organisation ${organisationId} could not be read: ${messageOf(err)}`] });
		}
		return { organisationSteps: await linkAndBringInLine(participant, params.participantId, organisationId, token) };
	},

	bringAccessInLine: async ({ locals, params }) => {
		const token = userToken(locals)!;
		const participant = await participantOrError(params.participantId, token);
		if (!participant.organisation_id) return fail(400, { organisationProblems: ['This participant has no Organisation yet.'] });
		return { organisationSteps: await bringAccessInLine(String(participant.space_id), String(participant.organisation_id), token) };
	},

	addRegulatorPerson: async ({ locals, params, request }) => {
		const token = userToken(locals)!;
		const participant = await participantOrError(params.participantId, token);
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		const set = String(form.get('role_set') ?? '');
		if (!username) return fail(400, { memberProblems: ['Give the username of the person to add.'] });
		if (!(REGULATOR_ROLE_SETS as readonly string[]).includes(set)) return fail(400, { memberProblems: ['Choose what the person will do.'] });
		return { memberSteps: await addRegulatorPerson(String(participant.space_id), username, set as RegulatorRoleSet, token), member: username };
	},

	setUpSpace: async ({ locals, params }) => {
		const token = userToken(locals)!;
		const participant = await participantOrError(params.participantId, token);
		try {
			const steps = await setUpParticipantSpace(String(participant.space_id), String(participant.legal_name), token);
			if (participant.organisation_id && (await participantSpaceReady(String(participant.space_id), token)))
				steps.push(...(await bringAccessInLine(String(participant.space_id), String(participant.organisation_id), token)));
			return { steps };
		} catch (err) {
			return fail(400, { problems: [messageOf(err)] });
		}
	}
};
