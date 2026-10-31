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
import { decisionsFor, isDecision, nowUtc } from '$lib/screening';
import { APPLICATION, CALL, SCREENING_DECISION } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { createRecord, getRecord, listRecords, userToken, type CohortRecord } from '$lib/server/records';
import { isStaffRole, requestStaffRole, staffAccess } from '$lib/server/staffAccess';
import { filesOfApplication, setScanStatus } from '$lib/server/files';
import type { Actions, PageServerLoad } from './$types';

/** An application as staff see it, through the community URL (CanGetDynamicEntityRecord_cohort_application). */
async function application(id: string, token: string | undefined) {
	try {
		return await getRecord(APPLICATION, 'community', id, token);
	} catch (err) {
		const message = messageOf(err);
		error(/OBP-20006|missing/i.test(message) ? 403 : 404, message);
	}
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const token = userToken(locals);
	const app = await application(params.id, token);
	const [call, decisions, access, files] = await Promise.allSettled([
		getRecord(CALL, 'public', String(app.call_id)),
		listRecords(SCREENING_DECISION, '', token),
		staffAccess(token!),
		filesOfApplication(params.id, token!)
	]);
	const roles = access.status === 'fulfilled' ? access.value.roles : [];
	const lacking = (name: string) => roles.find((r) => r.role_name === name && !r.held) ?? null;
	return {
		space: access.status === 'fulfilled' ? access.value.space : '',
		entitlementRequestsUrl: access.status === 'fulfilled' ? access.value.entitlementRequestsUrl : null,
		lackingDecide: lacking(`CanCreateDynamicEntityRecord_${SCREENING_DECISION}`),
		lackingReadDecisions: lacking(`CanGetDynamicEntityRecord_${SCREENING_DECISION}`),
		lackingReadFiles: lacking('CanGetFileAtOneBank'),
		canSetScanStatus: roles.some((r) => r.role_name === 'CanUpdateFileScanStatusAtOneBank' && r.held),
		files: files.status === 'fulfilled' ? files.value : [],
		filesError: files.status === 'rejected' ? messageOf(files.reason) : null,
		application: app,
		callTitle: call.status === 'fulfilled' ? String(call.value.title ?? '') : String(app.call_id),
		decisions: decisions.status === 'fulfilled' ? decisionsFor(params.id, decisions.value) : [],
		decisionsError: decisions.status === 'rejected' ? messageOf(decisions.reason) : null
	};
};

async function scan(locals: App.Locals, request: Request, status: 'clean' | 'rejected', reason: string) {
	const fileId = String((await request.formData()).get('file_id') ?? '');
	if (!fileId) return fail(400, { fileError: 'file_id' });
	try {
		await setScanStatus(fileId, status, reason, userToken(locals)!);
	} catch (err) {
		return fail(400, { fileError: messageOf(err) });
	}
	return { fileStatus: status };
}

export const actions: Actions = {
	/** Approve a file by hand, where no scanner is configured. */
	approveFile: async ({ locals, request }) =>
		scan(locals, request, 'clean', `Approved by ${locals.session.data.user?.username ?? 'staff'}`),
	/** Reject a file, e.g. one reported as unsuitable: its content is then served to nobody. */
	rejectFile: async ({ locals, request }) =>
		scan(locals, request, 'rejected', `Rejected by ${locals.session.data.user?.username ?? 'staff'}`),
	requestRole: async ({ locals, request }) => {
		const roleName = String((await request.formData()).get('role_name') ?? '');
		if (!isStaffRole(roleName)) return fail(400, { error: roleName });
		try {
			await requestStaffRole(roleName, userToken(locals)!);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { requested: roleName };
	},
	decide: async ({ params, locals, request }) => {
		const token = userToken(locals)!;
		const app = await application(params.id, token);
		if (app.status !== 'submitted') return fail(400, { error: 'not_submitted' });
		const form = await request.formData();
		const decision = String(form.get('decision') ?? '');
		if (!isDecision(decision)) return fail(400, { error: 'decision' });
		const record: CohortRecord = {
			application_id: params.id,
			call_id: String(app.call_id ?? ''),
			decision,
			reason: String(form.get('reason') ?? '').trim(),
			message_to_applicant: String(form.get('message_to_applicant') ?? '').trim(),
			decided_by_username: locals.session.data.user?.username ?? '',
			decided_at: nowUtc()
		};
		try {
			await createRecord(SCREENING_DECISION, '', Object.fromEntries(Object.entries(record).filter(([, v]) => v !== '')), token);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { decided: decision };
	}
};
