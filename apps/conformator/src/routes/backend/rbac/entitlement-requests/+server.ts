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
import { json } from '@sveltejs/kit';
import { obpRequests } from '$lib/server/obp';
import { messageOf } from '$lib/server/errors';
import { userToken } from '$lib/server/records';
import { STAFF_ROLES } from '$lib/server/staffAccess';
import { ROLE_SETS } from '$lib/server/participantRoles';
import { SPACE_SETUP_ROLES } from '$lib/server/participantSpace';
import type { RequestHandler } from './$types';

/** The Roles this app's pages use: only these may be asked for from here. */
const KNOWN = new Set([
	...STAFF_ROLES.map((r) => r.role_name),
	...Object.values(ROLE_SETS).flatMap((s) => s.roles),
	...SPACE_SETUP_ROLES,
	'CanCreateDynamicEntityRecord_conformator_report'
]);

/**
 * Ask for a Role, as the logged-in User, for the shared MissingRoleAlert widget: `{ role_name, bank_id }`. An
 * administrator accepts the request in the API Manager.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	const token = userToken(locals);
	if (!token) return json({ message: 'Log in to ask for a Role.' }, { status: 401 });
	const body = await request.json().catch(() => null);
	const roleName = String(body?.role_name ?? '');
	const bankId = String(body?.bank_id ?? '');
	if (!KNOWN.has(roleName)) return json({ message: `${roleName || 'That'} is not a Role this app uses.` }, { status: 400 });
	try {
		const created = await obpRequests.post('/obp/v5.1.0/entitlement-requests', { bank_id: bankId, role_name: roleName }, token);
		return json(created, { status: 201 });
	} catch (err) {
		return json({ message: messageOf(err) }, { status: 400 });
	}
};
