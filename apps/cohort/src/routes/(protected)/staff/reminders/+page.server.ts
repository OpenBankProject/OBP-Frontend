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
import { EMAIL_SWITCHES } from '$lib/emailSettings';
import { nowUtc } from '$lib/screening';
import { emailSettingsRecord } from '$lib/server/emailSettings';
import { EMAIL_SETTING, REMINDER } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { createRecord, listRecords, updateRecord, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole, write } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const READ_ROLE = `CanGetDynamicEntityRecord_${REMINDER}`;
const SETTINGS_ROLES = { create: `CanCreateDynamicEntityRecord_${EMAIL_SETTING}`, update: `CanUpdateDynamicEntityRecord_${EMAIL_SETTING}` };

/** The reminders Cohort has emailed on its own, newest first, read with the staff member's Get Role. */
export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const access = await staffAccess(token).catch(() => null);
	const role = access?.roles.find((r) => r.role_name === READ_ROLE);
	const { id: settingsId, settings } = await emailSettingsRecord();
	// Saving creates the record the first time and updates it after that: one Role or the other is needed.
	const settingsRole = access?.roles.find((r) => r.role_name === (settingsId ? SETTINGS_ROLES.update : SETTINGS_ROLES.create));
	const base = {
		space: access?.space ?? '',
		entitlementRequestsUrl: access?.entitlementRequestsUrl ?? null,
		settings,
		lackingSettings: settingsRole && !settingsRole.held ? settingsRole : null
	};
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
	/** Save which emails Cohort sends, and when. */
	emails: async ({ locals, request }) => {
		const form = await request.formData();
		const day = (key: string) => Number.parseInt(String(form.get(key) ?? ''), 10);
		const record = {
			...Object.fromEntries(EMAIL_SWITCHES.map((k) => [k, form.get(k) === 'on'])),
			due_soon_days: day('due_soon_days'),
			closing_soon_days: day('closing_soon_days'),
			updated_by_username: locals.session.data.user?.username ?? '',
			updated_at: nowUtc()
		};
		if (![record.due_soon_days, record.closing_soon_days].every((n) => Number.isInteger(n) && n >= 0 && n <= 90)) return fail(400, { form: 'emails', error: 'email_days_invalid' });
		const token = userToken(locals)!;
		const { id } = await emailSettingsRecord();
		return write('emails', () => (id ? updateRecord(EMAIL_SETTING, '', id, record, token) : createRecord(EMAIL_SETTING, '', record, token)), { saved: true });
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
