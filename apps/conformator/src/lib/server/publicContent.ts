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
import { listRecords } from './records';
import { REPORT, SUITE } from './entities/definitions';

/** How much there is for anyone to see. A count is null when OBP-API could not be asked; a link to something kept in OBP-API is then not shown, because it would not work. */
export interface PublicContent {
	suites: number | null;
	reports: number | null;
}

/** The suites on the public catalogue page (retired ones are left out there too) and the issued reports. */
export async function publicContent(): Promise<PublicContent> {
	const [suites, reports] = await Promise.all([
		listRecords(SUITE, undefined, { access: 'public' })
			.then((list) => list.filter((r) => r.record.status !== 'retired').length)
			.catch(() => null),
		listRecords(REPORT, undefined, { access: 'public' })
			.then((list) => list.length)
			.catch(() => null)
	]);
	return { suites, reports };
}
