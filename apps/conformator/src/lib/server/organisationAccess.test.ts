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
import { describe, expect, it } from 'vitest';
import { inLine, membersWithAccess, planAccess, SPACE_ADMIN_ROLE, type OrganisationMember, type SpaceEntitlement } from './organisationAccess';
import { APPROVER_ROLES, PARTICIPANT_MEMBER_ROLES, REVIEWER_ROLES } from './participantRoles';

const SPACE = 'conformator-example-bank';

function member(userId: string, memberRole = 'member'): OrganisationMember {
	return { user_id: userId, username: `${userId}@example.com`, provider: 'https://oidc.example.com', member_role: memberRole };
}

function holding(userId: string, roleNames: string[], bankId = SPACE): SpaceEntitlement[] {
	return roleNames.map((roleName) => ({ entitlement_id: `${userId}-${roleName}-${bankId}`, role_name: roleName, bank_id: bankId, user_id: userId }));
}

describe('planAccess', () => {
	it('gives admins and members the participant Roles', () => {
		const plan = planAccess(SPACE, [member('alice', 'admin'), member('bob', 'member')], []);
		expect(plan.grant.filter((g) => g.user_id === 'alice').map((g) => g.role_name)).toEqual(PARTICIPANT_MEMBER_ROLES);
		expect(plan.grant.filter((g) => g.user_id === 'bob').map((g) => g.role_name)).toEqual(PARTICIPANT_MEMBER_ROLES);
		expect(plan.remove).toEqual([]);
	});

	it('grants only the Roles a member does not hold yet', () => {
		const plan = planAccess(SPACE, [member('alice')], holding('alice', PARTICIPANT_MEMBER_ROLES.slice(1)));
		expect(plan.grant.map((g) => g.role_name)).toEqual([PARTICIPANT_MEMBER_ROLES[0]]);
	});

	it('is in line when every member holds every Role and nobody else does', () => {
		expect(inLine(planAccess(SPACE, [member('alice')], holding('alice', PARTICIPANT_MEMBER_ROLES)))).toBe(true);
	});

	it('takes the participant Roles away from someone who is no longer a member', () => {
		const plan = planAccess(SPACE, [], holding('carol', PARTICIPANT_MEMBER_ROLES));
		expect(plan.remove.map((r) => r.role_name)).toEqual(PARTICIPANT_MEMBER_ROLES);
		expect(plan.remove.every((r) => r.user_id === 'carol')).toBe(true);
	});

	it('touches only participant Roles, and only at this space', () => {
		const entitlements = [...holding('carol', ['CanGetCustomersAtOneBank']), ...holding('carol', PARTICIPANT_MEMBER_ROLES, 'conformator-other-bank')];
		expect(planAccess(SPACE, [], entitlements).remove).toEqual([]);
	});

	it("leaves the space's administrators alone", () => {
		const plan = planAccess(SPACE, [], holding('admin', [SPACE_ADMIN_ROLE, ...PARTICIPANT_MEMBER_ROLES]));
		expect(plan.remove).toEqual([]);
	});

	it("keeps the Roles a reviewer's or approver's own set needs", () => {
		const plan = planAccess(SPACE, [], [...holding('reviewer', REVIEWER_ROLES), ...holding('approver', APPROVER_ROLES)]);
		expect(plan.remove).toEqual([]);
	});

	it('takes from a reviewer the participant Roles their own set does not need', () => {
		const extra = PARTICIPANT_MEMBER_ROLES.filter((roleName) => !REVIEWER_ROLES.includes(roleName));
		const plan = planAccess(SPACE, [], holding('reviewer', [...REVIEWER_ROLES, ...extra]));
		expect(plan.remove.map((r) => r.role_name).sort()).toEqual([...extra].sort());
	});

	it('gives no Roles to a member whose member_role it does not know', () => {
		const plan = planAccess(SPACE, [member('dave', 'owner')], []);
		expect(plan.grant).toEqual([]);
		expect(plan.unknownMemberRoles.map((m) => m.user_id)).toEqual(['dave']);
	});
});

describe('membersWithAccess', () => {
	it('gives access to every member of an active Organisation', () => {
		expect(membersWithAccess('active', [member('alice')]).map((m) => m.user_id)).toEqual(['alice']);
	});

	it('gives no access to the members of a suspended Organisation, so the plan takes their Roles away', () => {
		const withAccess = membersWithAccess('suspended', [member('alice')]);
		expect(withAccess).toEqual([]);
		const plan = planAccess(SPACE, withAccess, holding('alice', PARTICIPANT_MEMBER_ROLES));
		expect(plan.remove.map((r) => r.role_name)).toEqual(PARTICIPANT_MEMBER_ROLES);
	});
});
