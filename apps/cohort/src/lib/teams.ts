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

/**
 * A startup's team is an OBP Organisation: a group of people, each an admin or a member. (This is not the hub's
 * network of organisations in `organisations.ts`, which are Customers of the space.) A participant record names its
 * team in `organisation_id`, and the team's members see the participation.
 */

export const MEMBER_ROLES = ['admin', 'member'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const isMemberRole = (value: unknown): value is MemberRole => (MEMBER_ROLES as readonly unknown[]).includes(value);

/** One of the logged-in User's Organisations, as GET /obp/v7.0.0/my/organisations returns it. */
export interface MyOrganisation {
	organisation_id: string;
	bank_id: string;
	name: string;
	status: string;
	member_role: MemberRole;
}

/** A member of an Organisation, as GET .../organisations/ORGANISATION_ID/members returns it. */
export interface OrganisationMember {
	user_id: string;
	username: string;
	member_role: MemberRole;
}

export function myOrganisationOf(json: Record<string, unknown>): MyOrganisation {
	const memberRole = json.member_role;
	return {
		organisation_id: String(json.organisation_id ?? ''),
		bank_id: String(json.bank_id ?? ''),
		name: String(json.name ?? ''),
		status: String(json.status ?? ''),
		member_role: isMemberRole(memberRole) ? memberRole : 'member'
	};
}

export function memberOf(json: Record<string, unknown>): OrganisationMember {
	const memberRole = json.member_role;
	return {
		user_id: String(json.user_id ?? ''),
		username: String(json.username ?? ''),
		member_role: isMemberRole(memberRole) ? memberRole : 'member'
	};
}

/**
 * Whether a User may see a participation: they are a member of its team, or, only while it has no team yet, they
 * are its applicant. Once a team is recorded, the applicant sees it only as a member of the team.
 */
export function canSeeParticipant(
	participant: { user_id: string; organisation_id: string },
	userId: string,
	myOrganisationIds: readonly string[]
): boolean {
	if (participant.organisation_id) return myOrganisationIds.includes(participant.organisation_id);
	return userId !== '' && participant.user_id === userId;
}

/** Admins first, then by name, so the list reads the same for every member. */
export function sortedMembers(members: OrganisationMember[]): OrganisationMember[] {
	return [...members].sort(
		(a, b) => MEMBER_ROLES.indexOf(a.member_role) - MEMBER_ROLES.indexOf(b.member_role) || a.username.localeCompare(b.username)
	);
}
