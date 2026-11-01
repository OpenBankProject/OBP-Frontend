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
import { assignmentStatus } from '$lib/evaluation';
import { APPLICATION, CALL, REVIEW_ASSIGNMENT, REVIEWER } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { assignments, reviewers, reviews, standingOf } from '$lib/server/evaluation';
import { createRecord, idOf, listRecords, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole, write } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const ROLES = {
	assignments: `CanGetDynamicEntityRecord_${REVIEW_ASSIGNMENT}`,
	applications: `CanGetDynamicEntityRecord_${APPLICATION}`
};

/**
 * A reviewer's page: their offer to review (a personal record, no Role), and, once staff have accepted it, the
 * applications assigned to them. Only the caller's own assignments are shown, though the Roles a reviewer needs read
 * more. Until the offer is accepted nothing about assignments is read or shown.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const me = locals.session.data.user?.user_id ?? '';
	const [profileList, standing] = await Promise.all([reviewers(token, 'my').catch(() => []), standingOf(me)]);
	const profile = profileList[0] ?? null;
	const base = { profile, standing, username: locals.session.data.user?.username ?? '' };
	if (!profile || standing !== 'accepted') return { ...base, assignments: [], assignmentsError: null, lacking: {}, space: '', entitlementRequestsUrl: null };
	const [assigned, mine, apps, calls, access] = await Promise.allSettled([
		assignments(token),
		reviews(token, 'my'),
		listRecords(APPLICATION, 'community', token),
		listRecords(CALL, 'public'),
		staffAccess(token)
	]);
	const roles = access.status === 'fulfilled' ? access.value.roles : [];
	const lacking = Object.fromEntries(
		Object.entries(ROLES).map(([k, name]) => [k, roles.find((r) => r.role_name === name && !r.held) ?? null])
	);
	const names = new Map((apps.status === 'fulfilled' ? apps.value : []).map((a) => [idOf(APPLICATION, a), String(a.startup_name ?? '')]));
	const titles = new Map((calls.status === 'fulfilled' ? calls.value : []).map((c) => [idOf(CALL, c), String(c.title ?? '')]));
	const myReviews = mine.status === 'fulfilled' ? mine.value : [];
	return {
		...base,
		assignments: (assigned.status === 'fulfilled' ? assigned.value : [])
			.filter((a) => a.reviewer_user_id === me)
			.map((a) => ({
				id: a.id,
				startup_name: names.get(a.application_id) ?? '',
				call: titles.get(a.call_id) ?? '',
				due_on: a.due_on,
				status: assignmentStatus(a.id, myReviews)
			})),
		assignmentsError: assigned.status === 'rejected' ? messageOf(assigned.reason) : null,
		lacking,
		space: access.status === 'fulfilled' ? access.value.space : '',
		entitlementRequestsUrl: access.status === 'fulfilled' ? access.value.entitlementRequestsUrl : null
	};
};

export const actions: Actions = {
	/** Offer to review: the caller's own cohort_reviewer record. */
	register: async ({ locals, request }) => {
		const token = userToken(locals)!;
		const form = await request.formData();
		const displayName = String(form.get('display_name') ?? '').trim();
		if (!displayName) return fail(400, { form: 'register', error: 'display_name' });
		if ((await reviewers(token, 'my').catch(() => [])).length > 0) return { form: 'register', registered: true };
		const record = {
			user_id: locals.session.data.user?.user_id ?? '',
			display_name: displayName,
			expertise: String(form.get('expertise') ?? '').trim(),
			status: 'available'
		};
		return write('register', () => createRecord(REVIEWER, 'my', record, token), { registered: true });
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
