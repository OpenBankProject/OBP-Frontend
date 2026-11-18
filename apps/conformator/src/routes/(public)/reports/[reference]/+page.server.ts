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
import { error, fail } from '@sveltejs/kit';
import { findReport } from '$lib/server/reports';
import { createRecord, idOf, userToken } from '$lib/server/records';
import { REPORT, REPORT_EVENT } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { roleCheck } from '$lib/server/staffAccess';
import type { Actions, PageServerLoad } from './$types';

const WITHDRAW_ROLE = `CanCreateDynamicEntityRecord_${REPORT_EVENT}`;

export const load: PageServerLoad = async ({ params, locals }) => {
	const found = await findReport(params.reference).catch((err) => error(503, `Reports cannot be read just now: ${messageOf(err)}`));
	if (!found) error(404, `There is no report ${params.reference}.`);
	const token = userToken(locals);
	const canWithdraw = token ? (await roleCheck(token).catch(() => () => false))(WITHDRAW_ROLE) : false;
	return { ...found, canWithdraw: canWithdraw && found.standing === 'valid' };
};

export const actions: Actions = {
	withdraw: async ({ params, locals, request }) => {
		const token = userToken(locals);
		if (!token) return fail(401, { problem: 'Log in to withdraw a report.' });
		const reason = String((await request.formData()).get('reason') ?? '').trim().slice(0, 4000);
		if (!reason) return fail(400, { problem: 'Give the reason for withdrawing it.' });
		const found = await findReport(params.reference);
		if (!found || found.standing !== 'valid') return fail(400, { problem: 'Only a valid report can be withdrawn.' });
		try {
			await createRecord(REPORT_EVENT, { report_id: idOf(REPORT, found.report), event: 'withdrawn', reason }, token);
		} catch (err) {
			return fail(400, { problem: messageOf(err) });
		}
		return { done: 'The report is withdrawn. Anyone checking it now sees that, with your reason.' };
	}
};
