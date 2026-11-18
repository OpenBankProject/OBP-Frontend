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
import { fail } from '@sveltejs/kit';
import { createRecord, listRecords, userToken } from '$lib/server/records';
import { REQUIREMENT } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { fields } from '$lib/server/forms';
import { roleCheck } from '$lib/server/staffAccess';
import { centralSpace } from '$lib/server/space';
import type { Actions, PageServerLoad } from './$types';

const CREATE_ROLE = `CanCreateDynamicEntityRecord_${REQUIREMENT}`;

export const load: PageServerLoad = async ({ locals }) => {
	const can = await roleCheck(userToken(locals)!);
	const requirements = (await listRecords(REQUIREMENT, undefined, { access: 'public' }))
		.map((r) => r.record)
		.sort((a, b) => String(a.reference).localeCompare(String(b.reference), undefined, { numeric: true }));
	return { requirements, canCreate: can(CREATE_ROLE), createRole: CREATE_ROLE, space: centralSpace() };
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		const { text, problems } = fields(await request.formData());
		const body = {
			reference: text('reference', 'The reference', { required: true, max: 64 }),
			title: text('title', 'The title', { required: true, max: 255 }),
			wording: text('wording', 'The wording', { max: 8000 }),
			source_document: text('source_document', 'The source document', { max: 255 }),
			source_version: text('source_version', 'The version', { max: 32 })
		};
		if (problems.length) return fail(400, { problems, values: body });
		try {
			await createRecord(REQUIREMENT, body, userToken(locals)!);
		} catch (err) {
			return fail(400, { problems: [messageOf(err)], values: body });
		}
		return { created: body.reference };
	}
};
