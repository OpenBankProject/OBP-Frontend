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
import { BOOKMARK } from './entities/definitions';
import { idOf, listRecords } from './records';

export const BOOKMARK_KINDS = ['call', 'application'] as const;
export type BookmarkKind = (typeof BOOKMARK_KINDS)[number];

export interface Bookmark {
	id: string;
	kind: BookmarkKind;
	target_id: string;
	label: string;
	path: string;
	saved_at: string;
}

/** The User's own bookmarks (/my/), newest first. Empty when they cannot be read. */
export async function myBookmarks(token: string): Promise<Bookmark[]> {
	const records = await listRecords(BOOKMARK, 'my', token).catch(() => []);
	return records
		.map((r) => ({
			id: idOf(BOOKMARK, r),
			kind: String(r.kind ?? '') as BookmarkKind,
			target_id: String(r.target_id ?? ''),
			label: String(r.label ?? ''),
			path: String(r.path ?? ''),
			saved_at: String(r.saved_at ?? '')
		}))
		.filter((b) => (BOOKMARK_KINDS as readonly string[]).includes(b.kind))
		.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
}

/** The User's bookmark of this record, if they saved it. */
export async function myBookmarkOf(kind: BookmarkKind, targetId: string, token: string | undefined): Promise<string | null> {
	if (!token) return null;
	return (await myBookmarks(token)).find((b) => b.kind === kind && b.target_id === targetId)?.id ?? null;
}
