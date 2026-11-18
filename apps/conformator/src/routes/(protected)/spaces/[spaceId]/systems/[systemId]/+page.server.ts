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
import { error, fail } from '@sveltejs/kit';
import { SYSTEM_ROLES } from '@obp/shared/conformator';
import { getRecord, updateRecord, userToken } from '$lib/server/records';
import { SYSTEM } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { roleCheck } from '$lib/server/staffAccess';
import { spaceName, spaceParam } from '$lib/server/spaces';
import { systemFromForm } from '$lib/server/systemForm';
import type { Actions, PageServerLoad } from './$types';

const UPDATE_SYSTEM = `CanUpdateDynamicEntityRecord_${SYSTEM}`;

async function systemOrError(space: string, id: string, token: string) {
	try {
		return (await getRecord(SYSTEM, id, token, { space })).record;
	} catch (err) {
		error(404, `The system could not be read: ${messageOf(err)}`);
	}
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const space = spaceParam(params.spaceId);
	const token = userToken(locals)!;
	const [system, name, can] = await Promise.all([systemOrError(space, params.systemId, token), spaceName(space, token), roleCheck(token)]);
	return { space, name, system, systemRoles: SYSTEM_ROLES, canEdit: can(UPDATE_SYSTEM, space) };
};

export const actions: Actions = {
	save: async ({ locals, params, request }) => {
		const space = spaceParam(params.spaceId);
		const token = userToken(locals)!;
		const current = await systemOrError(space, params.systemId, token);
		const { body, problems } = systemFromForm(await request.formData());
		// What a system is never changes: its runs and results were made for that role.
		if (body.system_role !== current.system_role) problems.push('What a system is cannot change. Add a new system instead.');
		if (problems.length) return fail(400, { problems, values: body });
		try {
			await updateRecord(SYSTEM, params.systemId, body, token, { space });
		} catch (err) {
			return fail(400, { problems: [messageOf(err)], values: body });
		}
		return { saved: true };
	}
};
