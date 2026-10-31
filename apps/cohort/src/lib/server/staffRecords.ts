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
import { messageOf } from './errors';
import { isStaffRole, requestStaffRole } from './staffAccess';
import type { CohortRecord } from './records';

/** The statuses of programmes and calls. */
export const STATUSES = ['draft', 'open', 'closed'];

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

/** Only the fields that were filled in: empty optional fields are left out of the record. */
function filled(record: Record<string, string>): CohortRecord {
	return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== ''));
}

const statusOf = (form: FormData) => (STATUSES.includes(str(form, 'status')) ? str(form, 'status') : 'draft');

/** A cohort_programme record from the programme form, used to create and to edit (a PUT replaces the record). */
export function readProgrammeForm(form: FormData): CohortRecord {
	return filled({
		name: str(form, 'name'),
		description: str(form, 'description'),
		status: statusOf(form),
		starts_on: str(form, 'starts_on'),
		ends_on: str(form, 'ends_on')
	});
}

/** A cohort_call record from the call form, used to create and to edit. */
export function readCallForm(form: FormData): CohortRecord {
	return filled({
		programme_id: str(form, 'programme_id'),
		title: str(form, 'title'),
		description: str(form, 'description'),
		status: statusOf(form),
		opens_at: str(form, 'opens_at'),
		closes_at: str(form, 'closes_at')
	});
}

/** Runs a write to OBP-API, turning a refusal into a form error. */
export async function write<T extends Record<string, unknown>>(which: string, run: () => Promise<unknown>, ok: T) {
	try {
		await run();
	} catch (err) {
		return fail(400, { form: which, error: messageOf(err) });
	}
	return { form: which, ...ok };
}

/** The requestRole form action shared by the staff pages. */
export async function requestRole(form: FormData, token: string) {
	const roleName = String(form.get('role_name') ?? '');
	if (!isStaffRole(roleName)) return fail(400, { form: 'role', error: roleName });
	return write('role', () => requestStaffRole(roleName, token), { requested: roleName });
}
