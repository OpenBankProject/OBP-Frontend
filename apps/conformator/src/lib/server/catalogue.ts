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
import { getRecord, listRecords, type EntityRecord } from './records';
import { REQUIREMENT, SUITE, TEST } from './entities/definitions';
import { inSuiteOrder, requirementIdsOf } from '$lib/catalogue';

/** A requirement, as shown beside the tests that cover it. */
export interface RequirementRef {
	id: string;
	reference: string;
	title: string;
}

/**
 * A suite version with its tests in suite order, and the requirements each test covers. The catalogue is public, so
 * this reads the public URLs and needs no token.
 */
export async function loadSuite(suiteId: string) {
	const [{ record: suite }, tests, requirements] = await Promise.all([
		getRecord(SUITE, suiteId, undefined, { access: 'public' }),
		listRecords(TEST, undefined, { access: 'public' }),
		listRecords(REQUIREMENT, undefined, { access: 'public' })
	]);
	const byId = new Map<string, RequirementRef>(
		requirements.map(({ record: r }) => [
			String(r.conformator_requirement_id),
			{ id: String(r.conformator_requirement_id), reference: String(r.reference ?? ''), title: String(r.title ?? '') }
		])
	);
	const own = inSuiteOrder(tests.map((t) => t.record).filter((t) => t.suite_id === suiteId));
	return {
		suite,
		tests: own.map((test: EntityRecord): EntityRecord => ({
			...test,
			requirements: requirementIdsOf(test.requirement_ids).map((id) => byId.get(id) ?? { id, reference: id, title: '(unknown requirement)' })
		})),
		requirements: [...byId.values()].sort((a, b) => a.reference.localeCompare(b.reference, undefined, { numeric: true }))
	};
}
