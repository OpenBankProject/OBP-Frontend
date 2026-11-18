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
import type { OrganisationMember } from './organisationAccess';

/**
 * A participant's people are an Organisation in OBP-API: its admins add and remove members themselves, and this app
 * reads the members to give them Roles at the participant's space. The regulator's staff create the Organisation and
 * read it with their own Roles, held at the central space, which is the Organisation's bank_id.
 */

/** The Roles at the central space for creating a participant's Organisation and reading it and its members. */
export const CREATE_ORGANISATION_ROLE = 'CanCreateOrganisationAtOneBank';
export const GET_ORGANISATION_ROLE = 'CanGetOrganisationAtOneBank';

/** An Organisation, as OBP-API gives it. */
export interface Organisation {
	organisation_id: string;
	bank_id: string;
	name: string;
	description: string;
	website?: string | null;
	status: string;
}

/** Find a User by username, which needs the system Role CanGetAnyUser. */
export async function userIdByUsername(username: string, token: string): Promise<string> {
	const user = await obpRequests.get(`/obp/v5.1.0/users/username/${encodeURIComponent(username)}`, token);
	return String(user?.user_id ?? '');
}

/** Create a participant's Organisation at the central space, with the User named as its first admin. */
export async function createOrganisation(name: string, adminUserId: string, token: string): Promise<Organisation> {
	return obpRequests.post('/obp/v7.0.0/management/organisations', { bank_id: centralSpace(), name, admin_user_id: adminUserId }, token);
}

export async function getOrganisation(organisationId: string, token: string): Promise<Organisation> {
	return obpRequests.get(`/obp/v7.0.0/management/organisations/${encodeURIComponent(organisationId)}`, token);
}

export async function organisationMembers(organisationId: string, token: string): Promise<OrganisationMember[]> {
	const response = await obpRequests.get(`/obp/v7.0.0/management/organisations/${encodeURIComponent(organisationId)}/members`, token);
	return response?.members ?? [];
}
