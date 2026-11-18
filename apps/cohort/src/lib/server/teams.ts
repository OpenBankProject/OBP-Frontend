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
import { memberOf, myOrganisationOf, sortedMembers, type MemberRole, type MyOrganisation, type OrganisationMember } from '$lib/teams';
import { obpRequests } from './obp';

/**
 * Startup teams, as OBP Organisations (v7.0.0). A startup's people manage their own team with their own token through
 * /my/organisations: OBP-API lets only members see it and only admins change it. A team founders create for
 * themselves is at SYS, and Cohort only records its organisation_id on the participant. Staff read teams with their
 * own CanGetOrganisationAtOneBank Role at SYS.
 */

const MY = '/obp/v7.0.0/my/organisations';
const MANAGEMENT = '/obp/v7.0.0/management/organisations';

const organisationPath = (organisationId: string) => `${MY}/${encodeURIComponent(organisationId)}`;
const memberPath = (organisationId: string, memberUserId: string) => `${organisationPath(organisationId)}/members/${encodeURIComponent(memberUserId)}`;

/** The Organisations the logged-in User belongs to, with their role in each. */
export async function myOrganisations(userToken: string): Promise<MyOrganisation[]> {
	const response = await obpRequests.get(MY, userToken);
	return ((response?.organisations ?? []) as Record<string, unknown>[]).map(myOrganisationOf);
}

/** A new team, at SYS, with the logged-in User as its first admin. Returns its id. */
export async function createTeam(userToken: string, details: { name: string; website: string }): Promise<string> {
	const created = await obpRequests.post(MY, { name: details.name, ...(details.website ? { website: details.website } : {}) }, userToken);
	const organisationId = String(created?.organisation_id ?? '');
	if (!organisationId) throw new Error('OBP-API did not return the new team.');
	return organisationId;
}

/** A team's members, read by one of its members. */
export async function teamMembers(organisationId: string, userToken: string): Promise<OrganisationMember[]> {
	const response = await obpRequests.get(`${organisationPath(organisationId)}/members`, userToken);
	return sortedMembers(((response?.members ?? []) as Record<string, unknown>[]).map(memberOf));
}

/** Add a person to a team by their OBP user_id. Only an admin of the team may. */
export async function addTeamMember(organisationId: string, memberUserId: string, memberRole: MemberRole, userToken: string): Promise<void> {
	await obpRequests.post(`${organisationPath(organisationId)}/members`, { user_id: memberUserId, member_role: memberRole }, userToken);
}

/** Make a member an admin, or an admin a member. Only an admin may; a team always keeps one admin. */
export async function changeTeamMemberRole(organisationId: string, memberUserId: string, memberRole: MemberRole, userToken: string): Promise<void> {
	await obpRequests.put(memberPath(organisationId, memberUserId), { member_role: memberRole }, userToken);
}

/** Remove a member. An admin may remove anyone; a member may remove themselves, which is leaving the team. */
export async function removeTeamMember(organisationId: string, memberUserId: string, userToken: string): Promise<void> {
	await obpRequests.delete(memberPath(organisationId, memberUserId), userToken);
}

/** One team, read with the staff member's own Role at SYS: its name and the space that administers it. */
export async function teamForStaff(organisationId: string, staffToken: string): Promise<{ organisation_id: string; bank_id: string; name: string }> {
	const organisation = await obpRequests.get(`${MANAGEMENT}/${encodeURIComponent(organisationId)}`, staffToken);
	return { organisation_id: String(organisation?.organisation_id ?? ''), bank_id: String(organisation?.bank_id ?? ''), name: String(organisation?.name ?? '') };
}

/** A team's members, read with the staff member's own Role. */
export async function teamMembersForStaff(organisationId: string, staffToken: string): Promise<OrganisationMember[]> {
	const response = await obpRequests.get(`${MANAGEMENT}/${encodeURIComponent(organisationId)}/members`, staffToken);
	return sortedMembers(((response?.members ?? []) as Record<string, unknown>[]).map(memberOf));
}
