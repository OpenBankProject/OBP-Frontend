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
import { listRecords } from '$lib/server/records';
import { SUITE } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import type { PageServerLoad } from './$types';

/** The public list of suites, newest version first within each code. Retired versions are left out. */
export const load: PageServerLoad = async () => {
	try {
		const suites = (await listRecords(SUITE, undefined, { access: 'public' }))
			.map((r) => r.record)
			.filter((s) => s.status !== 'retired')
			.sort((a, b) => String(a.code).localeCompare(String(b.code)) || String(b.version).localeCompare(String(a.version), undefined, { numeric: true }));
		return { suites, error: null };
	} catch (err) {
		const message = messageOf(err);
		// OBP-10404 / OBP-30001: the central space or its entities do not exist yet, on a new installation.
		const notSetUp = /OBP-10404|OBP-30001/.test(message);
		return { suites: [], error: notSetUp ? 'it is not set up yet. An administrator sets it up on the Setup page.' : message };
	}
};
