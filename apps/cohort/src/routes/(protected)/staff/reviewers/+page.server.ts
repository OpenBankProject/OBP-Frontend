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
import { reviewerStanding } from '$lib/evaluation';
import { nowUtc } from '$lib/screening';
import { REVIEWER, REVIEWER_DECISION } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { reviewers } from '$lib/server/evaluation';
import { createRecord, listRecords, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole, write } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const ROLES = {
	pool: `CanGetDynamicEntityRecord_${REVIEWER}`,
	decisions: `CanGetDynamicEntityRecord_${REVIEWER_DECISION}`,
	decide: `CanCreateDynamicEntityRecord_${REVIEWER_DECISION}`
};

const DECISIONS = ['accepted', 'declined'];

/**
 * The people who offered to review, each with their standing: pending until staff accept or decline the offer. Only
 * accepted reviewers are assigned applications. Decisions are append-only, so a reviewer can be accepted again later.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const [pool, decisions, access] = await Promise.allSettled([
		reviewers(token, 'community'),
		listRecords(REVIEWER_DECISION, '', token),
		staffAccess(token)
	]);
	const roles = access.status === 'fulfilled' ? access.value.roles : [];
	const lacking = Object.fromEntries(
		Object.entries(ROLES).map(([k, name]) => [k, roles.find((r) => r.role_name === name && !r.held) ?? null])
	);
	const decided = decisions.status === 'fulfilled' ? decisions.value : [];
	const order = { pending: 0, accepted: 1, declined: 2 };
	return {
		reviewers: (pool.status === 'fulfilled' ? pool.value : [])
			.map((r) => ({ ...r, standing: decisions.status === 'fulfilled' ? reviewerStanding(r.user_id, decided) : null }))
			.sort((a, b) => (order[a.standing ?? 'pending'] - order[b.standing ?? 'pending']) || a.display_name.localeCompare(b.display_name)),
		errors: { pool: pool.status === 'rejected' ? messageOf(pool.reason) : null },
		lacking,
		space: access.status === 'fulfilled' ? access.value.space : '',
		entitlementRequestsUrl: access.status === 'fulfilled' ? access.value.entitlementRequestsUrl : null
	};
};

export const actions: Actions = {
	decide: async ({ locals, request }) => {
		const token = userToken(locals)!;
		const form = await request.formData();
		const decision = String(form.get('decision') ?? '');
		const reviewerUserId = String(form.get('reviewer_user_id') ?? '');
		const reviewer = (await reviewers(token, 'community').catch(() => [])).find((r) => r.user_id === reviewerUserId);
		if (!DECISIONS.includes(decision) || !reviewer) return fail(400, { form: 'decide', error: 'invalid' });
		const reason = String(form.get('reason') ?? '').trim();
		const record = {
			reviewer_id: reviewer.id,
			reviewer_user_id: reviewer.user_id,
			decision,
			...(reason ? { reason } : {}),
			decided_by_username: locals.session.data.user?.username ?? '',
			decided_at: nowUtc()
		};
		return write('decide', () => createRecord(REVIEWER_DECISION, '', record, token), { decided: decision });
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
