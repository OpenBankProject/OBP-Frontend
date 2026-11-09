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
import { fail } from '@sveltejs/kit';
import { nowUtc } from '$lib/screening';
import { allAnnouncements } from '$lib/server/announcements';
import { ANNOUNCEMENT, PROGRAMME } from '$lib/server/entities/definitions';
import { createRecord, deleteRecord, idOf, listRecords, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole, write } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const ROLES = {
	create: `CanCreateDynamicEntityRecord_${ANNOUNCEMENT}`,
	remove: `CanDeleteDynamicEntityRecord_${ANNOUNCEMENT}`
};

/** The announcements, newest first, and the programmes one can be about. Publishing and removing need staff Roles. */
export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const [access, announcements, programmes] = await Promise.all([
		staffAccess(token).catch(() => null),
		allAnnouncements(),
		listRecords(PROGRAMME, 'public').catch(() => [])
	]);
	const roles = access?.roles ?? [];
	const lacking = Object.fromEntries(Object.entries(ROLES).map(([k, name]) => [k, roles.find((r) => r.role_name === name && !r.held) ?? null]));
	return {
		space: access?.space ?? '',
		entitlementRequestsUrl: access?.entitlementRequestsUrl ?? null,
		lacking,
		announcements,
		programmes: programmes.map((p) => ({ id: idOf(PROGRAMME, p), name: String(p.name ?? '') }))
	};
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export const actions: Actions = {
	/** Publish an announcement: public at once, on the open calls page or the programme's startups' page. */
	publish: async ({ locals, request }) => {
		const form = await request.formData();
		const record = {
			title: str(form, 'title').slice(0, 255),
			title_ar: str(form, 'title_ar').slice(0, 255),
			body: str(form, 'body').slice(0, 4000),
			body_ar: str(form, 'body_ar').slice(0, 4000),
			programme_id: str(form, 'programme_id'),
			published_at: nowUtc(),
			published_by_username: locals.session.data.user?.username ?? ''
		};
		if (!record.title) return fail(400, { form: 'publish', error: 'announcement_title_missing' });
		const body = Object.fromEntries(Object.entries(record).filter(([, v]) => v !== ''));
		return write('publish', () => createRecord(ANNOUNCEMENT, '', body, userToken(locals)!), { published: true });
	},
	remove: async ({ locals, request }) => {
		const id = str(await request.formData(), 'announcement_id');
		if (!id) return fail(400, { form: 'remove', error: 'invalid' });
		return write('remove', () => deleteRecord(ANNOUNCEMENT, '', id, userToken(locals)!), { removed: true });
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
