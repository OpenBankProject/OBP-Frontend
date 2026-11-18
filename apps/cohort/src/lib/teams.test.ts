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
import { describe, expect, it } from 'vitest';
import { canSeeParticipant, memberOf, myOrganisationOf, sortedMembers } from './teams';

describe('canSeeParticipant', () => {
	it('lets the applicant see a participation that has no team yet', () => {
		expect(canSeeParticipant({ user_id: 'founder', organisation_id: '' }, 'founder', [])).toBe(true);
		expect(canSeeParticipant({ user_id: 'founder', organisation_id: '' }, 'someone-else', ['team-a'])).toBe(false);
	});

	it("lets only the team's members see a participation once it has a team", () => {
		const participant = { user_id: 'founder', organisation_id: 'team-a' };
		expect(canSeeParticipant(participant, 'teammate', ['team-a'])).toBe(true);
		expect(canSeeParticipant(participant, 'founder', ['team-b'])).toBe(false);
	});

	it('never matches an empty user_id', () => {
		expect(canSeeParticipant({ user_id: '', organisation_id: '' }, '', [])).toBe(false);
	});
});

describe('teams from OBP-API', () => {
	it('reads a membership and treats an unknown role as member', () => {
		expect(myOrganisationOf({ organisation_id: 'o1', bank_id: 'cohort', name: 'Example Pay', status: 'active', member_role: 'admin' }).member_role).toBe('admin');
		expect(memberOf({ user_id: 'u1', username: 'sam', member_role: 'owner' }).member_role).toBe('member');
	});

	it('lists admins first, then by name', () => {
		const members = sortedMembers([
			{ user_id: 'u1', username: 'zoe', member_role: 'member' },
			{ user_id: 'u2', username: 'yusuf', member_role: 'admin' },
			{ user_id: 'u3', username: 'amal', member_role: 'member' }
		]);
		expect(members.map((m) => m.username)).toEqual(['yusuf', 'amal', 'zoe']);
	});
});
