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
import { centralSpace } from './space';
import { apiManagerUrl } from './appDirectory';
import { CREATE_ORGANISATION_ROLE, GET_ORGANISATION_ROLE } from './organisations';
import { PARTICIPANT, PARTICIPANT_DECISION, REPORT, REPORT_EVENT, REQUIREMENT, SUITE, TEST } from './entities/definitions';

/** A Role the regulator's staff need, what it is for, and where: the central space, or system-wide. */
export interface StaffRole {
	role_name: string;
	purpose: string;
	system?: boolean;
}

/** The Roles the staff pages use. Add a line here when a staff page starts needing a new one. */
export const STAFF_ROLES: StaffRole[] = [
	{ role_name: `CanCreateDynamicEntityRecord_${REQUIREMENT}`, purpose: 'Adding requirements to the catalogue.' },
	{ role_name: `CanUpdateDynamicEntityRecord_${REQUIREMENT}`, purpose: 'Correcting requirements.' },
	{ role_name: `CanCreateDynamicEntityRecord_${SUITE}`, purpose: 'Creating suites and new versions of them.' },
	{ role_name: `CanUpdateDynamicEntityRecord_${SUITE}`, purpose: 'Approving and retiring suite versions.' },
	{ role_name: `CanCreateDynamicEntityRecord_${TEST}`, purpose: 'Adding tests to a draft suite.' },
	{ role_name: `CanUpdateDynamicEntityRecord_${TEST}`, purpose: 'Changing the tests of a draft suite.' },
	{ role_name: 'CanCreateBankLevelDynamicEndpoint', purpose: "Loading a suite's OpenAPI file into OBP as dynamic endpoints." },
	{ role_name: `CanGetDynamicEntityRecord_${PARTICIPANT}`, purpose: 'Seeing the participant register.' },
	{ role_name: `CanCreateDynamicEntityRecord_${PARTICIPANT}`, purpose: 'Registering participants.' },
	{ role_name: `CanUpdateDynamicEntityRecord_${PARTICIPANT}`, purpose: 'Linking a participant to its Organisation.' },
	{ role_name: CREATE_ORGANISATION_ROLE, purpose: "Creating a participant's Organisation: the people who take part for it." },
	{ role_name: GET_ORGANISATION_ROLE, purpose: "Seeing a participant's Organisation and its members, to give them access to the participant's space." },
	{ role_name: `CanGetDynamicEntityRecord_${PARTICIPANT_DECISION}`, purpose: "Seeing participants' lifecycle." },
	{ role_name: `CanCreateDynamicEntityRecord_${PARTICIPANT_DECISION}`, purpose: 'Admitting, suspending and graduating participants.' },
	{ role_name: `CanCreateDynamicEntityRecord_${REPORT}`, purpose: 'Issuing conformance reports.' },
	{ role_name: `CanCreateDynamicEntityRecord_${REPORT_EVENT}`, purpose: 'Superseding and withdrawing reports.' },
	{ role_name: 'CanCreateBank', purpose: "Creating a participant's own space.", system: true },
	{ role_name: 'CanGetAnyUser', purpose: "Finding a person by username, to name the first admin of a participant's Organisation, or to add a reviewer or approver.", system: true }
];

/** The bank id a staff Role is held at: '' for a system Role, else the central space. */
export function spaceOfRole(roleName: string): string {
	return STAFF_ROLES.some((r) => r.role_name === roleName && r.system) ? '' : centralSpace();
}

export function isStaffRole(roleName: string): boolean {
	return STAFF_ROLES.some((r) => r.role_name === roleName);
}

interface Grant {
	role_name: string;
	bank_id: string;
}

/** Whether a list of grants includes a Role at a bank id. */
export function holds(grants: Grant[], roleName: string, bankId: string): boolean {
	return grants.some((g) => g.role_name === roleName && (g.bank_id ?? '') === bankId);
}

/** The User's current Roles, read from OBP-API rather than the session, so a Role granted since login counts at once. */
export async function currentUser(token: string): Promise<{ user_id: string; entitlements?: { list: Grant[] } }> {
	return obpRequests.get('/obp/v5.1.0/users/current', token);
}

/** Each staff Role: held, requested (an entitlement request is waiting), or neither. */
export async function staffAccess(token: string) {
	const [user, requests, manager] = await Promise.all([
		currentUser(token),
		obpRequests.get('/obp/v5.1.0/my/entitlement-requests', token).catch(() => ({ entitlement_requests: [] })),
		apiManagerUrl()
	]);
	const held: Grant[] = user?.entitlements?.list ?? [];
	const requested: Grant[] = requests?.entitlement_requests ?? [];
	return {
		user,
		space: centralSpace(),
		roles: STAFF_ROLES.map((r) => ({
			...r,
			bank_id: spaceOfRole(r.role_name),
			held: holds(held, r.role_name, spaceOfRole(r.role_name)),
			requested: holds(requested, r.role_name, spaceOfRole(r.role_name))
		})),
		entitlementRequestsUrl: manager ? `${manager}/rbac/entitlement-requests` : null
	};
}

/**
 * The staff Roles at the central space in a list of grants. Holding any makes the User staff for the menu; system
 * Roles such as CanGetAnyUser do not count on their own, as an OBP administrator may hold them for other reasons.
 * OBP-API still checks each Role.
 */
export function staffRolesIn(held: Grant[]): string[] {
	return STAFF_ROLES.filter((r) => !r.system && holds(held, r.role_name, centralSpace())).map((r) => r.role_name);
}

/** The staff Roles the User holds, read from OBP-API. */
export async function staffRolesHeld(token: string): Promise<string[]> {
	return staffRolesIn((await currentUser(token))?.entitlements?.list ?? []);
}

/** Whether a list of grants makes the User a reviewer or approver in any participant's space. */
export function reviewsIn(held: Grant[]): boolean {
	return held.some((g) => g.role_name === 'CanCreateDynamicEntityRecord_conformator_assessment' || g.role_name === 'CanCreateDynamicEntityRecord_conformator_approval');
}

/** Ask for a staff Role; an administrator accepts it in the API Manager. */
export async function requestStaffRole(roleName: string, token: string): Promise<void> {
	await obpRequests.post('/obp/v5.1.0/entitlement-requests', { bank_id: spaceOfRole(roleName), role_name: roleName }, token);
}

/**
 * A check of the User's Roles, read once from OBP-API: `can(role)` at the central space, or `can(role, bankId)`
 * elsewhere ('' for a system Role). Pages use it only to choose between a form and a request for the Role.
 */
export async function roleCheck(token: string): Promise<(roleName: string, bankId?: string) => boolean> {
	const held: Grant[] = (await currentUser(token))?.entitlements?.list ?? [];
	return (roleName, bankId = centralSpace()) => holds(held, roleName, bankId);
}
