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
import { fail, redirect } from '@sveltejs/kit';
import { SYSTEM_ROLES } from '@obp/shared/conformator';
import { createRecord, idOf, listRecords, userToken, type EntityRecord } from '$lib/server/records';
import { APPROVAL, REVIEW_ASSIGNMENT, RUN, SUBMISSION, SYSTEM } from '$lib/server/entities/definitions';
import { submissionStatus } from '$lib/review';
import { messageOf } from '$lib/server/errors';
import { roleCheck } from '$lib/server/staffAccess';
import { approvedSuitesFor, spaceName, spaceParam } from '$lib/server/spaces';
import { systemFromForm } from '$lib/server/systemForm';
import type { Actions, PageServerLoad } from './$types';

const CREATE_SYSTEM = `CanCreateDynamicEntityRecord_${SYSTEM}`;
const CREATE_RUN = `CanCreateDynamicEntityRecord_${RUN}`;

export const load: PageServerLoad = async ({ locals, params }) => {
	const space = spaceParam(params.spaceId);
	const token = userToken(locals)!;
	const can = await roleCheck(token);
	const [name, systems, runs, suites, submissions, approvals, assignments] = await Promise.all([
		spaceName(space, token),
		listRecords(SYSTEM, token, { space }).catch(() => null),
		listRecords(RUN, token, { space }).catch(() => null),
		approvedSuitesFor(null),
		listRecords(SUBMISSION, token, { space }).catch(() => null),
		listRecords(APPROVAL, token, { space }).catch(() => []),
		listRecords(REVIEW_ASSIGNMENT, token, { space }).catch(() => [])
	]);
	const systemName = new Map((systems ?? []).map(({ record }) => [idOf(SYSTEM, record), String(record.name)]));
	const suiteName = new Map(suites.map((s) => [String(s.conformator_suite_id), `${s.name} ${s.version}`]));
	return {
		space,
		name,
		systems: systems?.map((s) => s.record) ?? null,
		runs:
			runs
				?.map(({ record, metadata }): EntityRecord => ({
					...record,
					created_at: metadata.created?.at ?? '',
					system_name: systemName.get(String(record.system_id)) ?? String(record.system_id),
					suite_name: suiteName.get(String(record.suite_id)) ?? 'a suite no longer listed'
				}))
				.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))) ?? null,
		submissions:
			submissions
				?.map(({ record }): EntityRecord => {
					const id = idOf(SUBMISSION, record);
					const of = (list: typeof approvals) => list.map((r): EntityRecord => ({ ...r.record, created_at: r.metadata.created?.at ?? '' })).filter((r) => r.submission_id === id);
					return {
						id,
						submitted_at: String(record.submitted_at ?? ''),
						system_name: systemName.get(String(record.system_id)) ?? String(record.system_id),
						suite_name: suiteName.get(String(record.suite_id)) ?? 'a suite no longer listed',
						status: submissionStatus(of(approvals), of(assignments))
					};
				})
				.sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at))) ?? null,
		suites: suites.map((s) => ({ id: String(s.conformator_suite_id), label: `${s.name} ${s.version}`, system_role: String(s.system_role) })),
		systemRoles: SYSTEM_ROLES,
		can: { addSystem: can(CREATE_SYSTEM, space), startRun: can(CREATE_RUN, space) }
	};
};

export const actions: Actions = {
	addSystem: async ({ locals, params, request }) => {
		const space = spaceParam(params.spaceId);
		const { body, problems } = systemFromForm(await request.formData());
		if (problems.length) return fail(400, { system: { problems, values: body } });
		try {
			await createRecord(SYSTEM, body, userToken(locals)!, { space });
		} catch (err) {
			return fail(400, { system: { problems: [messageOf(err)], values: body } });
		}
		return { systemAdded: body.name };
	},

	startRun: async ({ locals, params, request }) => {
		const space = spaceParam(params.spaceId);
		const token = userToken(locals)!;
		const form = await request.formData();
		const systemId = String(form.get('system_id') ?? '');
		const suiteId = String(form.get('suite_id') ?? '');
		const [systems, suites] = await Promise.all([listRecords(SYSTEM, token, { space }), approvedSuitesFor(null)]);
		const system = systems.map((s) => s.record).find((s) => idOf(SYSTEM, s) === systemId);
		const suite = suites.find((s) => String(s.conformator_suite_id) === suiteId);
		if (!system || !suite) return fail(400, { run: { problems: ['Choose one of your systems and an approved suite.'] } });
		if (suite.system_role !== system.system_role)
			return fail(400, { run: { problems: [`${suite.name} tests an ${String(suite.system_role).replaceAll('_', ' ')}, but ${system.name} is an ${String(system.system_role).replaceAll('_', ' ')}.`] } });
		let run;
		try {
			run = await createRecord(RUN, { system_id: systemId, suite_id: suiteId, trigger: 'person', status: 'queued' }, token, { space });
		} catch (err) {
			return fail(400, { run: { problems: [messageOf(err)] } });
		}
		redirect(303, `/spaces/${space}/runs/${encodeURIComponent(idOf(RUN, run))}`);
	}
};
