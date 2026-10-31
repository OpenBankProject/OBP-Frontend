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
import { error } from '@sveltejs/kit';
import { CALL, PROGRAMME } from '$lib/server/entities/definitions';
import { getRecord, idOf, listRecords, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import type { PageServerLoad } from './$types';

/** A programme and its calls, read publicly. */
export const load: PageServerLoad = async ({ params, locals }) => {
	const token = userToken(locals);
	const programme = await getRecord(PROGRAMME, 'public', params.id).catch(() => error(404, 'Programme not found'));
	const [calls, access] = await Promise.all([
		listRecords(CALL, 'public').catch(() => []),
		staffAccess(token!).catch(() => null)
	]);
	return {
		programme,
		calls: calls
			.filter((c) => String(c.programme_id) === params.id)
			.map((c) => ({ id: idOf(CALL, c), title: String(c.title ?? ''), status: String(c.status ?? '') })),
		space: access?.space ?? '',
		entitlementRequestsUrl: access?.entitlementRequestsUrl ?? null
	};
};
