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
import { error } from '@sveltejs/kit';
import { obpRequests } from './obp';
import { centralSpace, isSpaceId } from './space';
import { currentUser } from './staffAccess';
import { MEMBER_MARKER_ROLE } from './participantRoles';
import { listRecords, type EntityRecord } from './records';
import { SUITE } from './entities/definitions';

/** The name of a bank (a participant's space), or its id when the name cannot be read. */
export async function spaceName(space: string, token: string): Promise<string> {
	try {
		const bank = await obpRequests.get(`/obp/v5.1.0/banks/${encodeURIComponent(space)}`, token);
		return String(bank?.full_name || space);
	} catch {
		return space;
	}
}

/**
 * The participants' spaces the User belongs to: those where they hold the Role to read systems. Read from OBP-API, so
 * a Role granted since login counts at once.
 */
export async function mySpaces(token: string, markerRole = MEMBER_MARKER_ROLE): Promise<Array<{ id: string; name: string }>> {
	const held = (await currentUser(token))?.entitlements?.list ?? [];
	const ids = [...new Set(held.filter((g) => g.role_name === markerRole && g.bank_id && g.bank_id !== centralSpace()).map((g) => g.bank_id))].sort();
	return Promise.all(ids.map(async (id) => ({ id, name: await spaceName(id, token) })));
}

/** A space id from the URL, checked before it goes into any OBP-API path. */
export function spaceParam(value: string): string {
	if (!isSpaceId(value) || value === centralSpace()) error(404, 'There is no such participant space.');
	return value;
}

/** The approved suites that test systems of a role, newest version first. */
export async function approvedSuitesFor(systemRole: string | null): Promise<EntityRecord[]> {
	return (await listRecords(SUITE, undefined, { access: 'public' }))
		.map((r) => r.record)
		.filter((s) => s.status === 'approved' && (systemRole === null || s.system_role === systemRole))
		.sort((a, b) => String(a.code).localeCompare(String(b.code)) || String(b.version).localeCompare(String(a.version), undefined, { numeric: true }));
}
