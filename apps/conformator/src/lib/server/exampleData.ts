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
import { EXAMPLE_OPENAPI_PATH, EXAMPLE_REQUIREMENTS, EXAMPLE_SOURCE, EXAMPLE_SUITE, EXAMPLE_TESTS } from '@obp/shared/conformator';
import { createRecord, fieldsOf, idOf, listRecords, updateRecord } from './records';
import { REQUIREMENT, SUITE, TEST } from './entities/definitions';
import { messageOf } from './errors';

export interface ExampleStep {
	step: string;
	ok: boolean;
	detail?: string;
}

/**
 * Add the example suite to the catalogue with the User's own Roles: its requirements, the suite, its tests, then
 * approve it. Adding again skips what exists, so it is safe to repeat. An earlier version of the example suite is
 * replaced and retired, and earlier example requirements are given their current references.
 */
export async function addExampleSuite(token: string, origin: string): Promise<ExampleStep[]> {
	const steps: ExampleStep[] = [];
	try {
		const existing = (await listRecords(REQUIREMENT, undefined, { access: 'public' })).map((r) => r.record);
		const ids: Record<string, string> = {};
		let renamed = 0;
		for (const req of EXAMPLE_REQUIREMENTS) {
			// Found by title, so an earlier example requirement under an older reference is corrected, not repeated.
			const found = existing.find((r) => r.source_document === EXAMPLE_SOURCE && (r.reference === req.reference || r.title === req.title));
			if (found) {
				ids[req.key] = idOf(REQUIREMENT, found);
				if (found.reference !== req.reference) {
					await updateRecord(REQUIREMENT, idOf(REQUIREMENT, found), { ...fieldsOf(REQUIREMENT, found), reference: req.reference }, token);
					renamed++;
				}
				continue;
			}
			const created = await createRecord(
				REQUIREMENT,
				{ reference: req.reference, title: req.title, wording: req.wording, source_document: EXAMPLE_SOURCE, source_version: '1' },
				token
			);
			ids[req.key] = idOf(REQUIREMENT, created);
		}
		steps.push({ step: `${EXAMPLE_REQUIREMENTS.length} example requirements${renamed ? ` (${renamed} given their new reference)` : ''}`, ok: true });

		const suites = (await listRecords(SUITE, undefined, { access: 'public' })).map((r) => r.record);
		const older = suites.filter((s) => s.code === EXAMPLE_SUITE.code && s.version !== EXAMPLE_SUITE.version);
		let suite = suites.find((s) => s.code === EXAMPLE_SUITE.code && s.version === EXAMPLE_SUITE.version);
		if (suite) steps.push({ step: `Suite ${EXAMPLE_SUITE.code} ${EXAMPLE_SUITE.version} is already there`, ok: true });
		else {
			const replaced = older.filter((s) => s.status === 'approved').at(-1);
			suite = await createRecord(
				SUITE,
				{ ...EXAMPLE_SUITE, openapi_url: `${origin}${EXAMPLE_OPENAPI_PATH}`, status: 'draft', ...(replaced ? { replaces_suite_id: idOf(SUITE, replaced) } : {}) },
				token
			);
			steps.push({ step: `Create suite ${EXAMPLE_SUITE.code} ${EXAMPLE_SUITE.version}${replaced ? `, replacing ${replaced.version}` : ''}`, ok: true });
		}
		const suiteId = idOf(SUITE, suite);

		if (suite.status === 'draft') {
			const present = new Set((await listRecords(TEST, undefined, { access: 'public' })).map((r) => r.record).filter((t) => t.suite_id === suiteId).map((t) => t.test_id));
			for (const [i, test] of EXAMPLE_TESTS.entries()) {
				if (present.has(test.test_id)) continue;
				await createRecord(
					TEST,
					{
						test_id: test.test_id,
						suite_id: suiteId,
						title: test.title,
						kind: test.kind,
						mandatory: test.mandatory,
						severity: test.severity,
						requirement_ids: JSON.stringify(test.requirements.map((k) => ids[k])),
						expected_result: test.expected_result,
						evidence_required: test.evidence_required ?? '',
						suggested_fix: test.suggested_fix ?? '',
						definition: test.definition ? JSON.stringify(test.definition) : '',
						position: i + 1
					},
					token
				);
			}
			steps.push({ step: `${EXAMPLE_TESTS.length} example tests`, ok: true });
			await updateRecord(SUITE, suiteId, { ...fieldsOf(SUITE, suite), status: 'approved' }, token);
			steps.push({ step: 'Approve the suite', ok: true });
		}

		// Earlier versions of the example suite are retired, so the catalogue shows only the current one.
		for (const old of older.filter((s) => s.status === 'approved')) {
			await updateRecord(SUITE, idOf(SUITE, old), { ...fieldsOf(SUITE, old), status: 'retired' }, token);
			steps.push({ step: `Retire suite ${EXAMPLE_SUITE.code} ${old.version}`, ok: true });
		}
		return steps;
	} catch (err) {
		steps.push({ step: 'Stopped', ok: false, detail: messageOf(err) });
		return steps;
	}
}
