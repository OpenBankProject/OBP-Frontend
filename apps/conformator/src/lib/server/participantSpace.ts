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
import { obpRequests } from './obp';
import { messageOf } from './errors';
import { bankExists } from './setupStatus';
import { currentUser, holds } from './staffAccess';
import { ensureEntities } from './entities/bootstrap';
import { PARTICIPANT_ENTITIES } from './entities/definitions';
import { dynamicEntityDefinitionsPath } from '@obp/shared/obp';
import { runnerSpaceScopes } from '@obp/shared/conformator';
import { runnerConsumerId } from './space';
import { ROLE_SETS, type RoleSet } from './participantRoles';

/** The Roles at a participant's space that setting it up needs. */
export const SPACE_SETUP_ROLES = ['CanGetDynamicEntityDefinitions', 'CanCreateDynamicEntityDefinition', 'CanUpdateDynamicEntityDefinition', 'CanCreateScopeAtOneBank'];

/** OBP-API refused a grant because it is already there: the step is already done. */
function alreadyThere(err: unknown): boolean {
	return /already|exists|duplicate/i.test(messageOf(err));
}

/** One step of setting up a participant's space, and how it went. */
export interface SpaceStep {
	step: string;
	ok: boolean;
	detail?: string;
}

/**
 * Set up a participant's own space, with the administrator's own token, and say how each step went. Safe to repeat:
 * every step checks first and does only what is missing.
 *
 * 1. Create the bank, if it does not exist. This needs the system Role CanCreateBank. OBP-API then gives the creator
 *    CanCreateEntitlementAtOneBank at the new bank.
 * 2. Grant the administrator the Roles to manage dynamic entities there, using that Role.
 * 3. Create the participant entities there. OBP-API gives the creator of each entity its record Roles.
 * 4. Grant the runner's Consumer its Scopes there (CONFORMATOR_RUNNER_CONSUMER_ID), so it can run tests in this space.
 */
export async function setUpParticipantSpace(space: string, legalName: string, token: string): Promise<SpaceStep[]> {
	const steps: SpaceStep[] = [];

	const exists = await bankExists(space, token);
	if (exists === null) return [{ step: `Check whether bank ${space} exists`, ok: false, detail: 'OBP-API could not be reached.' }];
	if (exists) steps.push({ step: `Bank ${space} exists`, ok: true });
	else {
		try {
			await obpRequests.post(
				'/obp/v6.0.0/banks',
				{ bank_id: space, bank_code: space.toUpperCase().slice(0, 32), full_name: legalName },
				token
			);
			steps.push({ step: `Create bank ${space}`, ok: true });
		} catch (err) {
			steps.push({ step: `Create bank ${space}`, ok: false, detail: messageOf(err) });
			return steps;
		}
	}

	const user = await currentUser(token);
	const held = user?.entitlements?.list ?? [];
	for (const role of SPACE_SETUP_ROLES) {
		if (holds(held, role, space)) {
			steps.push({ step: `You hold ${role} at ${space}`, ok: true });
			continue;
		}
		try {
			await obpRequests.post(`/obp/v7.0.0/users/${encodeURIComponent(user.user_id)}/entitlements`, { bank_id: space, role_name: role }, token);
			steps.push({ step: `Grant you ${role} at ${space}`, ok: true });
		} catch (err) {
			steps.push({ step: `Grant you ${role} at ${space}`, ok: false, detail: messageOf(err) });
			return steps;
		}
	}

	const entities = await ensureEntities(PARTICIPANT_ENTITIES, space, token);
	for (const [name, ok] of Object.entries(entities))
		steps.push({ step: `Dynamic entity ${name}`, ok, detail: ok ? undefined : 'Not created; the server log says why.' });
	if (!Object.values(entities).every(Boolean)) return steps;

	const runner = runnerConsumerId();
	if (!runner) {
		steps.push({ step: "Grant the runner's Scopes", ok: false, detail: 'CONFORMATOR_RUNNER_CONSUMER_ID is not set, so the runner cannot run tests here yet.' });
		return steps;
	}
	for (const scope of runnerSpaceScopes(space)) {
		try {
			await obpRequests.post(`/obp/v7.0.0/consumers/${encodeURIComponent(runner)}/scopes`, { bank_id: space, role_name: scope.role_name }, token);
			steps.push({ step: `Grant the runner ${scope.role_name}`, ok: true });
		} catch (err) {
			if (alreadyThere(err)) steps.push({ step: `The runner holds ${scope.role_name}`, ok: true });
			else steps.push({ step: `Grant the runner ${scope.role_name}`, ok: false, detail: messageOf(err) });
		}
	}
	return steps;
}

/**
 * Give a User one of the sets of Roles at a participant's space (the organisation's people, a reviewer or an approver),
 * with the administrator's own token: they hold CanCreateEntitlementAtOneBank there once they have set the space up.
 * Finds the User by username, which needs the system Role CanGetAnyUser. Roles already held are left as they are.
 */
export async function addMember(space: string, username: string, set: RoleSet, token: string): Promise<SpaceStep[]> {
	let user: { user_id: string; entitlements?: { list: Array<{ role_name: string; bank_id: string }> } };
	try {
		user = await obpRequests.get(`/obp/v5.1.0/users/username/${encodeURIComponent(username)}`, token);
	} catch (err) {
		return [{ step: `Find the User ${username}`, ok: false, detail: messageOf(err) }];
	}
	const held = user.entitlements?.list ?? [];
	const steps: SpaceStep[] = [{ step: `Find the User ${username}`, ok: true }];
	let granted = 0;
	for (const role of ROLE_SETS[set].roles) {
		if (holds(held, role, space)) continue;
		try {
			await obpRequests.post(`/obp/v7.0.0/users/${encodeURIComponent(user.user_id)}/entitlements`, { bank_id: space, role_name: role }, token);
			granted++;
		} catch (err) {
			if (!alreadyThere(err)) {
				steps.push({ step: `Grant ${role}`, ok: false, detail: messageOf(err) });
				return steps;
			}
		}
	}
	steps.push({ step: `Make ${username} ${ROLE_SETS[set].label} at ${space} (${granted} new Roles)`, ok: true });
	return steps;
}

/**
 * Which participant entities exist in a participant's space, read with the User's token: true or false for each, or
 * null for all when the definitions cannot be read (no bank yet, or no CanGetDynamicEntityDefinitions there).
 */
export async function participantSpaceEntities(space: string, token: string): Promise<Record<string, boolean> | null> {
	try {
		const response = await obpRequests.get(dynamicEntityDefinitionsPath(space), token);
		const names = new Set((response?.dynamic_entities ?? []).map((e: { entity_name: string }) => e.entity_name));
		return Object.fromEntries(PARTICIPANT_ENTITIES.map((d) => [d.entity_name, names.has(d.entity_name)]));
	} catch {
		return null;
	}
}
