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
import { error, fail, redirect } from '@sveltejs/kit';
import { isCallOpen } from '$lib/applications';
import { createCustomerForUser, myCustomer } from '$lib/server/customers';
import { APPLICATION, CALL } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { createRecord, getRecord, idOf, userToken } from '$lib/server/records';
import type { Actions, PageServerLoad } from './$types';

/**
 * Your details: the applicant becomes a Customer of Cohort's space (the legal person behind the login), then their
 * application to this call is started. Asked once; an applicant who is already a Customer goes straight on.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const token = userToken(locals)!;
	const call = await getRecord(CALL, 'public', params.id).catch(() => error(404, 'Call not found'));
	if (await myCustomer(token).catch(() => null)) redirect(303, `/calls/${params.id}`);
	return { callTitle: String(call.title ?? ''), email: locals.session.data.user?.email ?? '' };
};

export const actions: Actions = {
	default: async ({ params, locals, request }) => {
		const token = userToken(locals)!;
		const form = await request.formData();
		const details = {
			legal_name: String(form.get('legal_name') ?? '').trim(),
			mobile_phone_number: String(form.get('mobile_phone_number') ?? '').trim(),
			email: String(form.get('email') ?? '').trim()
		};
		if (!details.legal_name || !details.mobile_phone_number || !details.email) return fail(400, { ...details, missing: true });
		const call = await getRecord(CALL, 'public', params.id).catch(() => error(404, 'Call not found'));
		if (!isCallOpen(call)) error(400, 'This call is not open');
		let customerId: string;
		try {
			// Checked again here, so a second submit of the form does not make a second Customer.
			customerId =
				(await myCustomer(token))?.customer_id ??
				(await createCustomerForUser(locals.session.data.user?.user_id ?? '', details));
		} catch (err) {
			return fail(400, { ...details, error: messageOf(err) });
		}
		const created = await createRecord(APPLICATION, 'my', { call_id: params.id, status: 'draft', customer_id: customerId }, token);
		redirect(303, `/applications/${idOf(APPLICATION, created)}`);
	}
};
