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
import { CALL } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { idOf, listRecords, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { staffApplications, submittedApplications } from '$lib/server/staffApplications';
import { requestRole } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const READ_ROLE = 'CanGetDynamicEntityRecord_cohort_application';

/** Submitted applications, filtered by ?call_id= and ?decision= (a decision, or none for undecided). */
export const load: PageServerLoad = async ({ locals, url }) => {
	const token = userToken(locals)!;
	const filter = { call_id: url.searchParams.get('call_id') ?? '', decision: url.searchParams.get('decision') ?? '' };
	const [access, calls] = await Promise.all([
		staffAccess(token).catch(() => null),
		listRecords(CALL, 'public').catch(() => [])
	]);
	const role = access?.roles.find((r) => r.role_name === READ_ROLE);
	const base = {
		filter,
		calls: calls.map((c) => ({ id: idOf(CALL, c), title: String(c.title ?? '') })),
		space: access?.space ?? '',
		entitlementRequestsUrl: access?.entitlementRequestsUrl ?? null
	};
	if (role && !role.held) return { ...base, lacking: role, applications: [], error: null };
	try {
		return { ...base, lacking: null, applications: submittedApplications(await staffApplications(token, calls), filter), error: null };
	} catch (err) {
		return { ...base, lacking: null, applications: [], error: messageOf(err) };
	}
};

export const actions: Actions = {
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
