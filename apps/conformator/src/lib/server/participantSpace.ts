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
import { ROLE_SETS, type RegulatorRoleSet } from './participantRoles';
import { ACTIVE_STATUS, membersWithAccess, planAccess, type AccessPlan, type OrganisationMember, type SpaceEntitlement } from './organisationAccess';
import { getOrganisation, organisationMembers, type Organisation } from './organisations';

/**
 * The Roles at a participant's space that bringing its access in line with its Organisation needs, besides
 * CanCreateEntitlementAtOneBank. Staff who hold that Role there grant themselves these first.
 */
export const ORGANISATION_ACCESS_SELF_ROLES = ['CanGetEntitlementsForOneBank', 'CanDeleteEntitlementAtOneBank'];

/** The Roles at a participant's space that setting it up needs. */
export const SPACE_SETUP_ROLES = [
	'CanGetDynamicEntityDefinitions',
	'CanCreateDynamicEntityDefinition',
	'CanUpdateDynamicEntityDefinition',
	'CanCreateScopeAtOneBank',
	// To see who holds which Role there, and to take Roles away from people who have left the participant's
	// Organisation, when bringing access in line with it.
	...ORGANISATION_ACCESS_SELF_ROLES
];

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
 * Give one of the regulator's people (a reviewer or an approver) their set of Roles at a participant's space, with the
 * administrator's own token: they hold CanCreateEntitlementAtOneBank there once they have set the space up. Finds the
 * User by username, which needs the system Role CanGetAnyUser. Roles already held are left as they are. The
 * participant's own people get their Roles from its Organisation instead (bringAccessInLine).
 */
export async function addRegulatorPerson(space: string, username: string, set: RegulatorRoleSet, token: string): Promise<SpaceStep[]> {
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

/** The Role at a participant's space that bringing its access in line with its Organisation needs. */
export const ACCESS_SPACE_ROLE = 'CanCreateEntitlementAtOneBank';

/** Items grouped by their user_id, in the order they first appear. */
function byUser<T extends { user_id: string }>(items: T[]): Map<string, T[]> {
	const groups = new Map<string, T[]>();
	for (const item of items) groups.set(item.user_id, [...(groups.get(item.user_id) ?? []), item]);
	return groups;
}

/** OBP-API says the Entitlement is not there (OBP-30212): it is already gone. */
function alreadyGone(err: unknown): boolean {
	return /OBP-30212/.test(messageOf(err));
}

/** The Entitlements held at a space, which needs CanGetEntitlementsForOneBank there. */
async function spaceEntitlements(space: string, token: string): Promise<SpaceEntitlement[]> {
	const response = await obpRequests.get(`/obp/v5.1.0/banks/${encodeURIComponent(space)}/entitlements`, token);
	return response?.list ?? [];
}

/** An Organisation, its members, and what would change at a participant's space to bring access in line with them. */
export interface OrganisationAccess extends AccessPlan {
	organisation: Organisation;
	members: OrganisationMember[];
	/** Whether its members have access at all: a suspended Organisation's members have none. */
	membersHaveAccess: boolean;
}

/** What would change at a participant's space to bring its access in line with its Organisation, without changing it. */
export async function readOrganisationAccess(space: string, organisationId: string, token: string): Promise<OrganisationAccess> {
	const [organisation, members, entitlements] = await Promise.all([
		getOrganisation(organisationId, token),
		organisationMembers(organisationId, token),
		spaceEntitlements(space, token)
	]);
	const withAccess = membersWithAccess(organisation.status, members);
	return { ...planAccess(space, withAccess, entitlements), organisation, members, membersHaveAccess: organisation.status === ACTIVE_STATUS };
}

/**
 * Bring the participant Roles at a participant's space in line with the members of its Organisation, with the
 * administrator's own token, and say how each step went (see planAccess for the rules). Safe to repeat.
 *
 * 1. Grant the administrator CanGetEntitlementsForOneBank and CanDeleteEntitlementAtOneBank at the space if they lack
 *    them, using CanCreateEntitlementAtOneBank there.
 * 2. Read the Organisation and its members (CanGetOrganisationAtOneBank at the central space) and the Entitlements at
 *    the space. A suspended Organisation counts as having no members.
 * 3. Grant each member the Roles they lack.
 * 4. Take the participant Roles away from people who are not members, at the space only.
 */
export async function bringAccessInLine(space: string, organisationId: string, token: string): Promise<SpaceStep[]> {
	const steps: SpaceStep[] = [];
	const user = await currentUser(token);
	const held = user?.entitlements?.list ?? [];
	for (const roleName of ORGANISATION_ACCESS_SELF_ROLES) {
		if (holds(held, roleName, space)) continue;
		try {
			await obpRequests.post(`/obp/v7.0.0/users/${encodeURIComponent(user.user_id)}/entitlements`, { bank_id: space, role_name: roleName }, token);
			steps.push({ step: `Grant you ${roleName} at ${space}`, ok: true });
		} catch (err) {
			if (!alreadyThere(err)) {
				steps.push({ step: `Grant you ${roleName} at ${space}`, ok: false, detail: messageOf(err) });
				return steps;
			}
		}
	}

	let access: OrganisationAccess;
	try {
		access = await readOrganisationAccess(space, organisationId, token);
	} catch (err) {
		steps.push({ step: "Read the Organisation, its members and the Roles at the space", ok: false, detail: messageOf(err) });
		return steps;
	}
	steps.push({ step: `Read the Organisation's members (${access.members.length})`, ok: true });
	if (!access.membersHaveAccess)
		steps.push({ step: `The Organisation is ${access.organisation.status}, so its members get no access to the space`, ok: true });
	for (const unknown of access.unknownMemberRoles)
		steps.push({ step: `Give ${unknown.username} Roles`, ok: false, detail: `This app does not know the member_role ${unknown.member_role}, so they get none.` });

	for (const grants of byUser(access.grant).values()) {
		const username = grants[0].username;
		let granted = 0;
		let problem: string | null = null;
		for (const grant of grants) {
			try {
				await obpRequests.post(`/obp/v7.0.0/users/${encodeURIComponent(grant.user_id)}/entitlements`, { bank_id: space, role_name: grant.role_name }, token);
				granted++;
			} catch (err) {
				if (!alreadyThere(err)) {
					problem = `${grant.role_name}: ${messageOf(err)}`;
					break;
				}
			}
		}
		steps.push({ step: `Give ${username} the Roles of ${ROLE_SETS.participant.label} (${granted} new Roles)`, ok: problem === null, detail: problem ?? undefined });
	}

	for (const [removedUserId, removals] of byUser(access.remove)) {
		const username = access.members.find((m) => m.user_id === removedUserId)?.username ?? `the User ${removedUserId}`;
		let removed = 0;
		let problem: string | null = null;
		for (const removal of removals) {
			try {
				await obpRequests.delete(`/obp/v7.0.0/banks/${encodeURIComponent(space)}/entitlements/${encodeURIComponent(removal.entitlement_id)}`, token);
				removed++;
			} catch (err) {
				if (!alreadyGone(err)) {
					problem = `${removal.role_name}: ${messageOf(err)}`;
					break;
				}
			}
		}
		steps.push({ step: `Take the participant Roles away from ${username} (${removed} Roles)`, ok: problem === null, detail: problem ?? undefined });
	}
	if (access.grant.length === 0 && access.remove.length === 0) steps.push({ step: 'Access was already in line with the Organisation', ok: true });
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

/** Whether a participant's space is set up: its bank exists and so does every participant entity. */
export async function participantSpaceReady(space: string, token: string): Promise<boolean> {
	const entities = await participantSpaceEntities(space, token);
	return entities !== null && Object.values(entities).every(Boolean);
}
