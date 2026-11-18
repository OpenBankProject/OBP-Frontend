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
import { error, fail, redirect } from '@sveltejs/kit';
import { isOneOf, isTestId, parseTestDefinition, SEVERITIES, TEST_KINDS, unsavedPlaceholders } from '@obp/shared/conformator';
import { createRecord, fieldsOf, idOf, userToken, updateRecord } from '$lib/server/records';
import { SUITE, TEST } from '$lib/server/entities/definitions';
import { loadSuite } from '$lib/server/catalogue';
import { messageOf } from '$lib/server/errors';
import { fields, isDocumentUrl } from '$lib/server/forms';
import { roleCheck } from '$lib/server/staffAccess';
import { centralSpace } from '$lib/server/space';
import { approvalProblems, isEditable, nextVersion } from '$lib/catalogue';
import { suiteEndpoints } from '$lib/server/sources';
import { referenceStatus, startReferenceRun } from '$lib/server/reference';
import { opeySettings } from '$lib/server/opey';
import { env as publicEnv } from '$env/dynamic/public';
import type { Actions, PageServerLoad } from './$types';

const ADD_TEST_ROLE = `CanCreateDynamicEntityRecord_${TEST}`;
const UPDATE_SUITE_ROLE = `CanUpdateDynamicEntityRecord_${SUITE}`;
const CREATE_SUITE_ROLE = `CanCreateDynamicEntityRecord_${SUITE}`;

async function suiteOrError(suiteId: string) {
	try {
		return await loadSuite(suiteId);
	} catch (err) {
		error(404, `The suite could not be read: ${messageOf(err)}`);
	}
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const token = userToken(locals)!;
	const [loaded, can] = await Promise.all([suiteOrError(params.suiteId), roleCheck(token)]);
	const editable = isEditable(loaded.suite);
	// The endpoints of the suite's source, offered when writing a step; only while the suite can change.
	const [{ endpoints, problem: endpointsProblem }, reference] = await Promise.all([
		editable ? suiteEndpoints(loaded.suite) : Promise.resolve({ endpoints: [], problem: null }),
		referenceStatus(loaded.suite, token)
	]);
	return {
		...loaded,
		endpoints,
		endpointsProblem,
		// Opey, beside the page, where it is set up: it helps write tests and can fill in the "Add a test" form.
		opey: opeySettings(publicEnv.PUBLIC_OPEY_BASE_URL),
		reference,
		editable,
		approvalProblems: approvalProblems(loaded.tests, loaded.suite),
		testKinds: TEST_KINDS,
		severities: SEVERITIES,
		roles: { addTest: ADD_TEST_ROLE, updateSuite: UPDATE_SUITE_ROLE, createSuite: CREATE_SUITE_ROLE },
		can: { addTest: can(ADD_TEST_ROLE), updateSuite: can(UPDATE_SUITE_ROLE), createSuite: can(CREATE_SUITE_ROLE) },
		space: centralSpace()
	};
};

/** Write a suite back whole with a new status. */
async function setStatus(suite: Record<string, unknown>, status: string, token: string) {
	await updateRecord(SUITE, idOf(SUITE, suite), { ...fieldsOf(SUITE, suite), status }, token);
}

export const actions: Actions = {
	addTest: async ({ locals, params, request }) => {
		const { suite, tests } = await suiteOrError(params.suiteId);
		if (!isEditable(suite)) return fail(400, { problems: ['Only a draft suite can change. Make a new version instead.'] });
		const form = await request.formData();
		const { text, problems } = fields(form);
		const body = {
			test_id: text('test_id', 'The test ID', { required: true, max: 64 }).toUpperCase(),
			suite_id: params.suiteId,
			title: text('title', 'The title', { required: true, max: 255 }),
			kind: text('kind', 'The kind', { required: true }),
			mandatory: form.get('mandatory') === 'on',
			severity: text('severity', 'The severity', { required: true }),
			requirement_ids: JSON.stringify(form.getAll('requirement_ids').map(String).filter(Boolean)),
			expected_result: text('expected_result', 'What a pass looks like', { max: 4000 }),
			evidence_required: text('evidence_required', 'The evidence required', { max: 4000 }),
			suggested_fix: text('suggested_fix', 'The suggested fix', { max: 4000 }),
			definition: text('definition', 'The definition', { max: 20000 }),
			position: tests.length + 1
		};
		if (body.test_id && !isTestId(body.test_id)) problems.push('The test ID needs two to four groups of capital letters or digits joined by hyphens, such as PIS-IDEM-004.');
		if (tests.some((t) => t.test_id === body.test_id)) problems.push(`${body.test_id} is already in this suite.`);
		if (!isOneOf(TEST_KINDS, body.kind)) problems.push('Choose the kind of test.');
		if (!isOneOf(SEVERITIES, body.severity)) problems.push('Choose the severity.');
		const advice: string[] = [];
		if (body.definition) {
			const parsed = parseTestDefinition(body.definition);
			if (!parsed.ok) problems.push(...parsed.problems);
			else advice.push(...unsavedPlaceholders(parsed.definition));
		}
		if (problems.length) return fail(400, { problems, values: { ...body, requirement_ids: form.getAll('requirement_ids').map(String) } });
		try {
			await createRecord(TEST, body, userToken(locals)!);
		} catch (err) {
			return fail(400, { problems: [messageOf(err)], values: body });
		}
		return { added: body.test_id, advice };
	},

	setOpenapi: async ({ locals, params, request }) => {
		const { suite } = await suiteOrError(params.suiteId);
		if (!isEditable(suite)) return fail(400, { problems: ['Only a draft suite can change. Make a new version instead.'] });
		const url = String((await request.formData()).get('openapi_url') ?? '').trim();
		if (url && !isDocumentUrl(url)) return fail(400, { problems: ['The OpenAPI document URL must start with https:// (or http://localhost while trying it out).'] });
		try {
			await updateRecord(SUITE, params.suiteId, { ...fieldsOf(SUITE, suite), openapi_url: url }, userToken(locals)!);
		} catch (err) {
			return fail(400, { problems: [messageOf(err)] });
		}
		return { statusChanged: url ? 'checking responses against that OpenAPI document' : 'without an OpenAPI document' };
	},

	/** Run the suite against the reference (the OBP sandbox, or the mock of a loaded file), draft or not. */
	runReference: async ({ locals, params }) => {
		const { suite } = await suiteOrError(params.suiteId);
		let started;
		try {
			started = await startReferenceRun(suite, userToken(locals)!);
		} catch (err) {
			return fail(400, { problems: [messageOf(err)] });
		}
		redirect(303, `/spaces/${started.space}/runs/${encodeURIComponent(started.runId)}`);
	},

	approve: async ({ locals, params }) => {
		const { suite, tests } = await suiteOrError(params.suiteId);
		if (!isEditable(suite)) return fail(400, { problems: ['Only a draft suite can be approved.'] });
		const problems = approvalProblems(tests, suite);
		if (problems.length) return fail(400, { problems });
		try {
			await setStatus(suite, 'approved', userToken(locals)!);
		} catch (err) {
			return fail(400, { problems: [messageOf(err)] });
		}
		return { statusChanged: 'approved' };
	},

	retire: async ({ locals, params }) => {
		const { suite } = await suiteOrError(params.suiteId);
		if (suite.status !== 'approved') return fail(400, { problems: ['Only an approved suite can be retired.'] });
		try {
			await setStatus(suite, 'retired', userToken(locals)!);
		} catch (err) {
			return fail(400, { problems: [messageOf(err)] });
		}
		return { statusChanged: 'retired' };
	},

	/** A new draft version: a copy of the suite and its tests, which can then change. */
	newVersion: async ({ locals, params }) => {
		const { suite, tests } = await suiteOrError(params.suiteId);
		const token = userToken(locals)!;
		let copy;
		try {
			copy = await createRecord(
				SUITE,
				{ ...fieldsOf(SUITE, suite), version: nextVersion(String(suite.version)), status: 'draft', replaces_suite_id: params.suiteId },
				token
			);
			const copyId = idOf(SUITE, copy);
			for (const test of tests) {
				const { requirements: _requirements, ...record } = test;
				await createRecord(TEST, { ...fieldsOf(TEST, record), suite_id: copyId }, token);
			}
		} catch (err) {
			return fail(400, { problems: [`The new version could not be made in full: ${messageOf(err)}`] });
		}
		redirect(303, `/staff/suites/${encodeURIComponent(idOf(SUITE, copy))}`);
	}
};
