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
import { OPEY_CONVERSATION } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { idOf, listRecordsWithMetadata, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const READ_ROLE = `CanGetDynamicEntityRecord_${OPEY_CONVERSATION}`;

/** Every User's Opey conversations, read through the community URL: the audit log. Newest first. */
export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const access = await staffAccess(token).catch(() => null);
	const role = access?.roles.find((r) => r.role_name === READ_ROLE);
	const base = { space: access?.space ?? '', entitlementRequestsUrl: access?.entitlementRequestsUrl ?? null };
	if (role && !role.held) return { ...base, lacking: role, conversations: [], error: null };
	try {
		const rows = await listRecordsWithMetadata(OPEY_CONVERSATION, 'community', token);
		const conversations = rows
			.map(({ record, metadata }) => ({
				id: idOf(OPEY_CONVERSATION, record),
				title: String(record.title ?? ''),
				user_id: String(metadata.created?.on_behalf_of_user_id ?? metadata.created?.user_id ?? ''),
				page: String(record.page ?? ''),
				message_count: Number(record.message_count ?? 0),
				started_at: String(record.started_at ?? ''),
				updated_at: String(record.updated_at ?? '')
			}))
			.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
		return { ...base, lacking: null, conversations, error: null };
	} catch (err) {
		return { ...base, lacking: null, conversations: [], error: messageOf(err) };
	}
};

export const actions: Actions = {
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
