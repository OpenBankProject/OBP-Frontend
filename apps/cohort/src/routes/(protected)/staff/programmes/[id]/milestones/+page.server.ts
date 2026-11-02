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
import { milestoneProgress, REVIEW_DECISIONS, todayUtc } from '$lib/milestones';
import { nowUtc } from '$lib/screening';
import { MILESTONE, MILESTONE_REPORT, MILESTONE_REVIEW, PARTICIPANT, PROGRAMME } from '$lib/server/entities/definitions';
import { messageOf } from '$lib/server/errors';
import { filesOfRecord } from '$lib/server/files';
import { milestonesOf, reports, reviewsForStaff } from '$lib/server/milestones';
import { participantOf } from '$lib/server/participants';
import { createRecord, getRecord, listRecords, userToken } from '$lib/server/records';
import { staffAccess } from '$lib/server/staffAccess';
import { requestRole, write } from '$lib/server/staffRecords';
import type { Actions, PageServerLoad } from './$types';

const ROLES = {
	define: `CanCreateDynamicEntityRecord_${MILESTONE}`,
	participants: `CanGetDynamicEntityRecord_${PARTICIPANT}`,
	reports: `CanGetDynamicEntityRecord_${MILESTONE_REPORT}`,
	review: `CanCreateDynamicEntityRecord_${MILESTONE_REVIEW}`,
	reviews: `CanGetDynamicEntityRecord_${MILESTONE_REVIEW}`,
	files: 'CanGetFileAtOneBank'
};

/**
 * A programme's milestones (public), and with the staff member's own Roles: each participant's progress on each
 * milestone, who is behind, and the reports waiting for review, with their evidence files.
 */
export const load: PageServerLoad = async ({ params, locals }) => {
	const token = userToken(locals)!;
	const programme = await getRecord(PROGRAMME, 'public', params.id).catch(() => error(404, 'Programme not found'));
	const [milestones, participantRecords, reportList, reviewList, access] = await Promise.allSettled([
		milestonesOf(params.id),
		listRecords(PARTICIPANT, '', token),
		reports('community', token),
		reviewsForStaff(token),
		staffAccess(token)
	]);
	const roles = access.status === 'fulfilled' ? access.value.roles : [];
	const lacking = Object.fromEntries(Object.entries(ROLES).map(([k, name]) => [k, roles.find((r) => r.role_name === name && !r.held) ?? null]));
	const ms = milestones.status === 'fulfilled' ? milestones.value : [];
	const participants = (participantRecords.status === 'fulfilled' ? participantRecords.value : [])
		.map(participantOf)
		.filter((p) => p.programme_id === params.id);
	const allReports = reportList.status === 'fulfilled' ? reportList.value : [];
	const allReviews = reviewList.status === 'fulfilled' ? reviewList.value : [];
	const today = todayUtc();
	const rows = participants.map((p) => {
		const cells = ms.map((m) => {
			const progress = milestoneProgress(m, p.id, allReports, allReviews, today);
			return { milestone_id: m.id, status: progress.status, behind: progress.behind };
		});
		return { id: p.id, startup_name: p.startup_name, application_id: p.application_id, cells, behind: cells.filter((c) => c.behind).length };
	});
	// Reports waiting for review: the newest report of a milestone a participant has not had accepted or returned.
	const waiting = participants.flatMap((p) =>
		ms.flatMap((m) => {
			const progress = milestoneProgress(m, p.id, allReports, allReviews, today);
			return progress.status === 'submitted' && progress.latestReport
				? [{ report: progress.latestReport, milestone: m.title, startup_name: p.startup_name }]
				: [];
		})
	);
	const pending = await Promise.all(
		waiting.map(async (w) => ({ ...w, files: lacking.files ? [] : await filesOfRecord(MILESTONE_REPORT, w.report.id, token).catch(() => []) }))
	);
	return {
		programme: { id: params.id, name: String(programme.name ?? '') },
		milestones: ms,
		rows,
		pending,
		lacking,
		errors: {
			participants: participantRecords.status === 'rejected' ? messageOf(participantRecords.reason) : null,
			reports: reportList.status === 'rejected' ? messageOf(reportList.reason) : null
		},
		space: access.status === 'fulfilled' ? access.value.space : '',
		entitlementRequestsUrl: access.status === 'fulfilled' ? access.value.entitlementRequestsUrl : null
	};
};

const str = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

export const actions: Actions = {
	addMilestone: async ({ params, locals, request }) => {
		const form = await request.formData();
		const title = str(form, 'title');
		const dueOn = str(form, 'due_on');
		if (!title || (dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(dueOn))) return fail(400, { form: 'milestone', error: 'invalid' });
		const position = (await milestonesOf(params.id)).length + 1;
		const record = {
			programme_id: params.id,
			title,
			position,
			...(str(form, 'description') ? { description: str(form, 'description') } : {}),
			...(dueOn ? { due_on: dueOn } : {})
		};
		return write('milestone', () => createRecord(MILESTONE, '', record, userToken(locals)!), { added: true });
	},
	/** Accept a report, or return it with a message: a new review, with the staff member's own Role. */
	review: async ({ locals, request }) => {
		const token = userToken(locals)!;
		const form = await request.formData();
		const decision = str(form, 'decision');
		const reportId = str(form, 'report_id');
		if (!(REVIEW_DECISIONS as readonly string[]).includes(decision) || !reportId) return fail(400, { form: 'review', error: 'invalid' });
		const report = (await reports('community', token).catch(() => [])).find((r) => r.id === reportId);
		if (!report) return fail(400, { form: 'review', error: 'invalid' });
		const message = str(form, 'message_to_startup');
		if (decision === 'returned' && !message) return fail(400, { form: 'review', error: 'message_needed' });
		const record = {
			report_id: report.id,
			milestone_id: report.milestone_id,
			participant_id: report.participant_id,
			decision,
			...(message ? { message_to_startup: message } : {}),
			decided_by_username: locals.session.data.user?.username ?? '',
			decided_at: nowUtc()
		};
		return write('review', () => createRecord(MILESTONE_REVIEW, '', record, token), { reviewed: decision });
	},
	requestRole: async ({ locals, request }) => requestRole(await request.formData(), userToken(locals)!)
};
