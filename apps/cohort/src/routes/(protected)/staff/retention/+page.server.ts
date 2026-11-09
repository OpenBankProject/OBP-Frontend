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
import { policyBody, SUGGESTIONS } from '$lib/retention';
import { COHORT_ENTITIES } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { userToken } from '$lib/server/records';
import { createPolicy, decideRun, deletePolicy, policies, preview, runPolicy, runs, updatePolicy } from '$lib/server/retention';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole, write } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const ROLES = {
	read: 'CanGetRetentionPolicies',
	manage: 'CanManageRetentionPolicy',
	run: 'CanRunRetentionPolicy',
	approve: 'CanApproveRetentionRun',
	runs: 'CanGetRetentionRuns'
};

/** Retention at Cohort's space: the policies, what each would do now, and the runs, with the staff member's Roles. */
export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const access = await staffAccess(token).catch(() => null);
	const roles = access?.roles ?? [];
	const lacking = Object.fromEntries(Object.entries(ROLES).map(([k, name]) => [k, roles.find((r) => r.role_name === name && !r.held) ?? null]));
	const base = {
		space: access?.space ?? '',
		entitlementRequestsUrl: access?.entitlementRequestsUrl ?? null,
		lacking,
		suggestions: SUGGESTIONS,
		entityNames: COHORT_ENTITIES.map((e) => e.entity_name)
	};
	let error: string | null = null;
	const list = lacking.read ? [] : await policies(token).catch((err) => ((error = messageOf(err)), []));
	const withPreview = await Promise.all(list.map(async (p) => ({ ...p, preview: await preview(p.retention_policy_id, token).catch((err) => ({ error: messageOf(err) })) })));
	const runList = lacking.runs ? [] : await runs(token).catch(() => []);
	return { ...base, policies: withPreview, runs: runList.sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50), error };
};

const id = (form: FormData) => String(form.get('retention_policy_id') ?? '');

export const actions: Actions = {
	save: async ({ locals, request }) => {
		const form = await request.formData();
		const body = policyBody(form, !!id(form));
		if (!body) return fail(400, { form: 'policy', error: 'retention_invalid' });
		const token = userToken(locals)!;
		return write('policy', () => (id(form) ? updatePolicy(id(form), body, token) : createPolicy(body, token)), { saved: true });
	},
	remove: async ({ locals, request }) => write('policy', async () => deletePolicy(id(await request.formData()), userToken(locals)!), { removed: true }),
	/** Run now. OBP-API refuses when archiving or deleting is switched off in its props, and says so. */
	run: async ({ locals, request }) => write('run', async () => runPolicy(id(await request.formData()), userToken(locals)!), { started: true }),
	decide: async ({ locals, request }) => {
		const form = await request.formData();
		return write('run', () => decideRun(String(form.get('retention_run_id') ?? ''), form.get('decision') === 'approve', userToken(locals)!), { decided: true });
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
