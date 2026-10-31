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
import { error } from '@sveltejs/kit';
import { latestDecision } from '$lib/screening';
import { APPLICATION, CALL, PROGRAMME, SCREENING_DECISION } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { getRecord, idOf, listRecords, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import type { PageServerLoad } from './$types';

/**
 * A call, read publicly, and the applications to it, read through the community URL (needs
 * CanGetDynamicEntityRecord_cohort_application).
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const token = userToken(locals);
	const call = await getRecord(CALL, 'public', params.id).catch(() => error(404, 'Call not found'));
	const [programme, applications, decisions, access] = await Promise.allSettled([
		getRecord(PROGRAMME, 'public', String(call.programme_id)),
		listRecords(APPLICATION, 'community', token),
		listRecords(SCREENING_DECISION, '', token),
		staffAccess(token!)
	]);
	const roles = access.status === 'fulfilled' ? access.value.roles : [];
	const lacking = (name: string) => roles.find((r) => r.role_name === name && !r.held) ?? null;
	const decisionList = decisions.status === 'fulfilled' ? decisions.value : [];
	return {
		call,
		programme: programme.status === 'fulfilled'
			? { id: String(call.programme_id), name: String(programme.value.name ?? '') }
			: null,
		applications: applications.status === 'fulfilled'
			? applications.value
					.filter((a) => String(a.call_id) === params.id)
					.map((a) => ({
						id: idOf(APPLICATION, a),
						startup_name: String(a.startup_name ?? ''),
						status: String(a.status ?? ''),
						submitted_at: String(a.submitted_at ?? ''),
						decision: String(latestDecision(idOf(APPLICATION, a), decisionList)?.decision ?? '')
					}))
			: [],
		applicationsError: applications.status === 'rejected' ? messageOf(applications.reason) : null,
		lackingApplications: lacking(`CanGetDynamicEntityRecord_${APPLICATION}`),
		space: access.status === 'fulfilled' ? access.value.space : '',
		entitlementRequestsUrl: access.status === 'fulfilled' ? access.value.entitlementRequestsUrl : null
	};
};
