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
import { PARTICIPANT_MEMBER_ROLES, ROLE_SETS, type RoleSet } from './participantRoles';

/**
 * Working out who should hold which Roles at a participant's space, from the members of the participant's
 * Organisation in OBP-API. Pure functions, so they can be tested without OBP-API; participantSpace.ts makes the calls.
 */

/**
 * The set of Roles each member_role of an Organisation gets at the participant's space. Admins and members get the
 * same: everything a participant does in Conformator is open to all its people. What an admin can do beyond that
 * (add and remove members, link Consumers to the Organisation) OBP-API itself allows, with no Role.
 */
export const MEMBER_ROLE_SETS: Record<string, RoleSet> = {
	admin: 'participant',
	member: 'participant'
};

/**
 * The Role whose holders at a space are its administrators: they set the space up, and can grant themselves any Role
 * there again, so bringing access in line with the Organisation leaves their Roles alone.
 */
export const SPACE_ADMIN_ROLE = 'CanCreateEntitlementAtOneBank';

/** A member of an Organisation, as GET /obp/v7.0.0/management/organisations/ORGANISATION_ID/members gives it. */
export interface OrganisationMember {
	user_id: string;
	username: string;
	provider: string;
	member_role: string;
}

/** An Entitlement at a bank, as GET /obp/v5.1.0/banks/BANK_ID/entitlements gives it. */
export interface SpaceEntitlement {
	entitlement_id: string;
	role_name: string;
	bank_id: string;
	user_id: string;
}

/** A Role to grant a member at the space. */
export interface AccessGrant {
	user_id: string;
	username: string;
	role_name: string;
}

/** An Entitlement to take away from someone who is no longer a member. */
export interface AccessRemoval {
	entitlement_id: string;
	user_id: string;
	role_name: string;
}

/** What has to change at a space so that its participant Roles match the Organisation's members. */
export interface AccessPlan {
	grant: AccessGrant[];
	remove: AccessRemoval[];
	/** Members whose member_role this app does not know, so who get no Roles. */
	unknownMemberRoles: OrganisationMember[];
}

/**
 * The regulator's sets of Roles (reviewer, approver) that a User holds at the space. A set counts as held when the
 * User holds any of its Roles that the participant's people never get, such as creating an assessment.
 */
function regulatorSetsHeld(roleNames: Set<string>): RoleSet[] {
	const participantRoles = new Set(PARTICIPANT_MEMBER_ROLES);
	return (Object.keys(ROLE_SETS) as RoleSet[]).filter(
		(setName) =>
			setName !== 'participant' && ROLE_SETS[setName].roles.some((roleName) => !participantRoles.has(roleName) && roleNames.has(roleName))
	);
}

/**
 * What to grant and take away at a participant's space so that its participant Roles follow the Organisation:
 *
 * - Each member gets the Roles of the set for their member_role, unless they hold them already.
 * - Anyone else who holds one of the participant Roles there loses it, with three exceptions: only those Role names
 *   are touched, only at this space; the space's administrators are left alone; and a Role that a reviewer's or
 *   approver's own set also needs is kept for them.
 */
export function planAccess(space: string, members: OrganisationMember[], entitlements: SpaceEntitlement[]): AccessPlan {
	const atSpace = entitlements.filter((entitlement) => (entitlement.bank_id ?? '') === space);
	const rolesByUser = new Map<string, Set<string>>();
	for (const entitlement of atSpace) {
		const roleNames = rolesByUser.get(entitlement.user_id) ?? new Set<string>();
		roleNames.add(entitlement.role_name);
		rolesByUser.set(entitlement.user_id, roleNames);
	}

	const grant: AccessGrant[] = [];
	const unknownMemberRoles: OrganisationMember[] = [];
	const memberUserIds = new Set<string>();
	for (const member of members) {
		const setName = MEMBER_ROLE_SETS[member.member_role];
		if (!setName) {
			unknownMemberRoles.push(member);
			continue;
		}
		memberUserIds.add(member.user_id);
		const held = rolesByUser.get(member.user_id) ?? new Set<string>();
		for (const roleName of ROLE_SETS[setName].roles)
			if (!held.has(roleName)) grant.push({ user_id: member.user_id, username: member.username, role_name: roleName });
	}

	const participantRoles = new Set(PARTICIPANT_MEMBER_ROLES);
	const remove: AccessRemoval[] = [];
	for (const entitlement of atSpace) {
		if (!participantRoles.has(entitlement.role_name) || memberUserIds.has(entitlement.user_id)) continue;
		const held = rolesByUser.get(entitlement.user_id) ?? new Set<string>();
		if (held.has(SPACE_ADMIN_ROLE)) continue;
		const keptForRegulator = regulatorSetsHeld(held).some((setName) => (ROLE_SETS[setName].roles as readonly string[]).includes(entitlement.role_name));
		if (keptForRegulator) continue;
		remove.push({ entitlement_id: entitlement.entitlement_id, user_id: entitlement.user_id, role_name: entitlement.role_name });
	}

	return { grant, remove, unknownMemberRoles };
}

/** The status of an Organisation whose members have access. A suspended Organisation's members have none. */
export const ACTIVE_STATUS = 'active';

/** The members who get access at the participant's space: all of them while the Organisation is active, else none. */
export function membersWithAccess(status: string, members: OrganisationMember[]): OrganisationMember[] {
	return status === ACTIVE_STATUS ? members : [];
}

/** Whether a plan has nothing to do. */
export function inLine(plan: AccessPlan): boolean {
	return plan.grant.length === 0 && plan.remove.length === 0;
}
