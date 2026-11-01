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
import { error, fail } from '@sveltejs/kit';
import { assignmentStatus, rankApplications, reviewerStanding } from '$lib/evaluation';
import { nowUtc } from '$lib/screening';
import { APPLICATION, CALL, REVIEW, REVIEW_ASSIGNMENT, REVIEWER, RUBRIC_CRITERION } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { assignments, reviewerDecisionsAsCohort, reviewers, reviews, rubricOf } from '$lib/server/evaluation';
import { createRecord, getRecord, idOf, listRecords, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole, write } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const ROLES = {
	rubric: `CanCreateDynamicEntityRecord_${RUBRIC_CRITERION}`,
	pool: `CanGetDynamicEntityRecord_${REVIEWER}`,
	assign: `CanCreateDynamicEntityRecord_${REVIEW_ASSIGNMENT}`,
	assignments: `CanGetDynamicEntityRecord_${REVIEW_ASSIGNMENT}`,
	reviews: `CanGetDynamicEntityRecord_${REVIEW}`,
	applications: `CanGetDynamicEntityRecord_${APPLICATION}`
};

/**
 * Evaluation of a call: its rubric, the reviewers assigned to each submitted application with how far they got, and
 * the applications ranked by their average score. Each part needs its own Role and offers to request it.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const token = userToken(locals)!;
	const call = await getRecord(CALL, 'public', params.id).catch(() => error(404, 'Call not found'));
	const [rubric, apps, assigned, written, pool, access, offers] = await Promise.allSettled([
		rubricOf(params.id),
		listRecords(APPLICATION, 'community', token),
		assignments(token),
		reviews(token, 'community'),
		reviewers(token, 'community'),
		staffAccess(token),
		reviewerDecisionsAsCohort()
	]);
	const offerDecisions = offers.status === 'fulfilled' ? offers.value : [];
	const roles = access.status === 'fulfilled' ? access.value.roles : [];
	const lacking = Object.fromEntries(
		Object.entries(ROLES).map(([k, name]) => [k, roles.find((r) => r.role_name === name && !r.held) ?? null])
	);
	const submitted = (apps.status === 'fulfilled' ? apps.value : [])
		.filter((a) => String(a.call_id) === params.id && a.status === 'submitted')
		.map((a) => ({ id: idOf(APPLICATION, a), startup_name: String(a.startup_name ?? '') }));
	const callAssignments = (assigned.status === 'fulfilled' ? assigned.value : []).filter((a) => a.call_id === params.id);
	const reviewList = written.status === 'fulfilled' ? written.value : [];
	const ranked = new Map(rankApplications(submitted.map((a) => a.id), reviewList).map((r) => [r.application_id, r]));
	const rows = submitted
		.map((a) => ({
			...a,
			average: ranked.get(a.id)?.average ?? null,
			rank: ranked.get(a.id)?.rank ?? null,
			reviewers: callAssignments
				.filter((x) => x.application_id === a.id)
				.map((x) => ({
					name: x.reviewer_name,
					due_on: x.due_on,
					status: assignmentStatus(x.id, reviewList),
					score: reviewList.find((r) => r.assignment_id === x.id)?.total_score ?? null
				}))
		}))
		.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
	return {
		call: { id: params.id, title: String(call.title ?? '') },
		rubric: rubric.status === 'fulfilled' ? rubric.value : [],
		rows,
		pool: (pool.status === 'fulfilled' ? pool.value : []).filter(
			(r) => r.status !== 'unavailable' && reviewerStanding(r.user_id, offerDecisions) === 'accepted'
		),
		lacking,
		errors: { applications: apps.status === 'rejected' ? messageOf(apps.reason) : null },
		space: access.status === 'fulfilled' ? access.value.space : '',
		entitlementRequestsUrl: access.status === 'fulfilled' ? access.value.entitlementRequestsUrl : null
	};
};

const int = (form: FormData, key: string) => Math.trunc(Number(form.get(key) ?? ''));

export const actions: Actions = {
	addCriterion: async ({ params, locals, request }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const max = int(form, 'max_score');
		const weight = int(form, 'weight') || 1;
		if (!name || !(max >= 1 && max <= 100) || !(weight >= 1 && weight <= 10)) return fail(400, { form: 'criterion', error: 'invalid' });
		const position = (await rubricOf(params.id)).length + 1;
		const record = { call_id: params.id, name, description: String(form.get('description') ?? '').trim(), max_score: max, weight, position };
		return write('criterion', () => createRecord(RUBRIC_CRITERION, '', record, userToken(locals)!), { added: true });
	},
	assign: async ({ params, locals, request }) => {
		const token = userToken(locals)!;
		const form = await request.formData();
		const applicationId = String(form.get('application_id') ?? '');
		const reviewerUserId = String(form.get('reviewer_user_id') ?? '');
		const pool = await reviewers(token, 'community').catch(() => []);
		const reviewer = pool.find((r) => r.user_id === reviewerUserId);
		if (!applicationId || !reviewer || reviewerStanding(reviewer.user_id, await reviewerDecisionsAsCohort()) !== 'accepted') {
			return fail(400, { form: 'assign', error: 'reviewer' });
		}
		const existing = await assignments(token).catch(() => []);
		if (existing.some((a) => a.application_id === applicationId && a.reviewer_user_id === reviewerUserId)) {
			return fail(400, { form: 'assign', error: 'already_assigned' });
		}
		const dueOn = String(form.get('due_on') ?? '').trim();
		const record = {
			application_id: applicationId,
			call_id: params.id,
			reviewer_user_id: reviewer.user_id,
			reviewer_name: reviewer.display_name,
			assigned_by_username: locals.session.data.user?.username ?? '',
			assigned_at: nowUtc(),
			...(dueOn ? { due_on: dueOn } : {})
		};
		return write('assign', () => createRecord(REVIEW_ASSIGNMENT, '', record, token), { assigned: true });
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
