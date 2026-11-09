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
import { fail, redirect } from '@sveltejs/kit';
import { nowUtc } from '$lib/screening';
import { BOOKMARK_KINDS, myBookmarks } from '$lib/server/bookmarks';
import { BOOKMARK } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { createRecord, deleteRecord, userToken } from '$lib/server/records';
import type { Actions, PageServerLoad } from './$types';

/** The User's saved calls and applications. */
export const load: PageServerLoad = async ({ locals }) => ({ bookmarks: await myBookmarks(userToken(locals)!) });

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
/** Back to the page the button was on: a path in Cohort only. */
const back = (path: string) => (path.startsWith('/') && !path.startsWith('//') ? path : '/saved');

export const actions: Actions = {
	/** Save a record from the page it is on (the BookmarkButton), and go back there. */
	save: async ({ locals, request }) => {
		const form = await request.formData();
		const kind = str(form, 'kind');
		const record = { kind, target_id: str(form, 'target_id'), label: str(form, 'label').slice(0, 255), path: back(str(form, 'path')), saved_at: nowUtc() };
		if (!(BOOKMARK_KINDS as readonly string[]).includes(kind) || !record.target_id) return fail(400, { error: 'invalid' });
		try {
			await createRecord(BOOKMARK, 'my', record, userToken(locals)!);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		redirect(303, record.path);
	},
	/** Remove one of the User's own bookmarks; back to the page it came from, or here. */
	remove: async ({ locals, request }) => {
		const form = await request.formData();
		try {
			await deleteRecord(BOOKMARK, 'my', str(form, 'bookmark_id'), userToken(locals)!);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		redirect(303, back(str(form, 'return_to')));
	}
};
