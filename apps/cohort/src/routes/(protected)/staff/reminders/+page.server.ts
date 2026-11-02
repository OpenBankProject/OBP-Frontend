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
import { REMINDER } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { listRecords, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const READ_ROLE = `CanGetDynamicEntityRecord_${REMINDER}`;

/** The reminders Cohort has emailed on its own, newest first, read with the staff member's Get Role. */
export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const access = await staffAccess(token).catch(() => null);
	const role = access?.roles.find((r) => r.role_name === READ_ROLE);
	const base = { space: access?.space ?? '', entitlementRequestsUrl: access?.entitlementRequestsUrl ?? null };
	if (role && !role.held) return { ...base, lacking: role, reminders: [], error: null };
	try {
		const reminders = (await listRecords(REMINDER, '', token))
			.map((r) => ({
				key: String(r.reminder_key ?? ''),
				kind: String(r.kind ?? ''),
				about: String(r.about ?? ''),
				startup_name: String(r.startup_name ?? ''),
				sent_at: String(r.sent_at ?? '')
			}))
			.sort((a, b) => b.sent_at.localeCompare(a.sent_at));
		return { ...base, lacking: null, reminders, error: null };
	} catch (err) {
		return { ...base, lacking: null, reminders: [], error: messageOf(err) };
	}
};

export const actions: Actions = {
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
