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
import { isCallOpen } from '$lib/applications';
import { CALL, PROGRAMME } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { idOf, listRecords } from '$lib/server/records';
import type { PageServerLoad } from './$types';

/** The open calls, read publicly so visitors see them without logging in. */
export const load: PageServerLoad = async () => {
	try {
		const [calls, programmes] = await Promise.all([listRecords(CALL, 'public'), listRecords(PROGRAMME, 'public')]);
		const programmeNames = new Map(programmes.map((p) => [idOf(PROGRAMME, p), String(p.name ?? '')]));
		return {
			calls: calls.filter((c) => isCallOpen(c)).map((c) => ({
				id: idOf(CALL, c),
				title: String(c.title ?? ''),
				description: String(c.description ?? ''),
				opens_at: String(c.opens_at ?? ''),
				closes_at: String(c.closes_at ?? ''),
				programme: programmeNames.get(String(c.programme_id)) ?? ''
			})),
			error: null
		};
	} catch (err) {
		return { calls: [], error: messageOf(err) };
	}
};
