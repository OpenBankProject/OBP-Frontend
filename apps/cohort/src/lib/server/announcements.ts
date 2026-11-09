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
import { announcementOf, newestFirst, type Announcement } from '$lib/announcements';
import { ANNOUNCEMENT } from './entities/definitions';
import { idOf, listRecords } from './records';

/** Every announcement, newest first: they are public, so read without a token. Empty when they cannot be read. */
export async function allAnnouncements(): Promise<Announcement[]> {
	const records = await listRecords(ANNOUNCEMENT, 'public').catch(() => []);
	return records.map((r) => announcementOf(idOf(ANNOUNCEMENT, r), r)).sort(newestFirst);
}
