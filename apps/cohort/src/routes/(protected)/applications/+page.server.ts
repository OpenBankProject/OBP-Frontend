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
import { APPLICATION, CALL } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { idOf, listRecords, userToken } from '$lib/server/records';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	try {
		const [applications, calls] = await Promise.all([
			listRecords(APPLICATION, 'my', userToken(locals)),
			listRecords(CALL, 'public')
		]);
		const callTitles = new Map(calls.map((c) => [idOf(CALL, c), String(c.title ?? '')]));
		return {
			applications: applications.map((a) => ({
				id: idOf(APPLICATION, a),
				call: callTitles.get(String(a.call_id)) ?? String(a.call_id),
				startup_name: String(a.startup_name ?? ''),
				status: String(a.status ?? 'draft')
			})),
			error: null
		};
	} catch (err) {
		return { applications: [], error: messageOf(err) };
	}
};
