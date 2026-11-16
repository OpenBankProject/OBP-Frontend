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
import { describe, expect, it } from 'vitest';
import { approvalProblems, inSuiteOrder, isEditable, nextTestId, nextVersion, requirementIdsOf, suggestSuite } from './catalogue';
import { isTestId } from '@obp/shared/conformator';

describe('requirementIdsOf', () => {
	it('reads a JSON list of ids', () => {
		expect(requirementIdsOf('["a", "b"]')).toEqual(['a', 'b']);
	});

	it('counts empty, unreadable or non-list text as none', () => {
		expect(requirementIdsOf('')).toEqual([]);
		expect(requirementIdsOf('[a')).toEqual([]);
		expect(requirementIdsOf('{"a":1}')).toEqual([]);
		expect(requirementIdsOf(undefined)).toEqual([]);
	});

	it('drops anything that is not an id', () => {
		expect(requirementIdsOf('["a", 2, "", null]')).toEqual(['a']);
	});
});

describe('inSuiteOrder', () => {
	it('sorts by position, then by test ID, with unplaced tests last', () => {
		const tests = [
			{ test_id: 'AIS-003' },
			{ test_id: 'AIS-002', position: 2 },
			{ test_id: 'AIS-001', position: 2 },
			{ test_id: 'AIS-009', position: 1 }
		];
		expect(inSuiteOrder(tests).map((t) => t.test_id)).toEqual(['AIS-009', 'AIS-001', 'AIS-002', 'AIS-003']);
	});
});

describe('isEditable', () => {
	it('lets only a draft change', () => {
		expect(isEditable({ status: 'draft' })).toBe(true);
		expect(isEditable({ status: 'approved' })).toBe(false);
		expect(isEditable({ status: 'retired' })).toBe(false);
	});
});

describe('nextVersion', () => {
	it('raises the minor version', () => {
		expect(nextVersion('1.2.0')).toBe('1.3.0');
		expect(nextVersion('2.9.4')).toBe('2.10.0');
	});

	it('adds .1 to a version that is not three numbers', () => {
		expect(nextVersion('2026-a')).toBe('2026-a.1');
	});
});

describe('approvalProblems', () => {
	const valid = JSON.stringify({ steps: [{ kind: 'request', name: 'Get', method: 'GET', path: '/accounts', credentials: 'customer' }] });

	it('needs at least one test', () => {
		expect(approvalProblems([])).toEqual(['The suite has no tests.']);
	});

	it('accepts automated tests with valid definitions and other kinds without one', () => {
		expect(
			approvalProblems([
				{ test_id: 'AIS-001', kind: 'automated', definition: valid },
				{ test_id: 'GOV-001', kind: 'evidence', definition: '' }
			])
		).toEqual([]);
	});

	it('names automated tests with a missing or broken definition', () => {
		expect(
			approvalProblems([
				{ test_id: 'AIS-001', kind: 'automated', definition: '' },
				{ test_id: 'AIS-002', kind: 'automated', definition: '{"steps": []}' }
			])
		).toEqual(['AIS-001 is automated but has no definition.', 'AIS-002 has a definition with problems: The definition has no steps.']);
	});
});

describe('approvalProblems and schemas', () => {
	const withSchema = JSON.stringify({ steps: [{ kind: 'request', name: 'Get', method: 'GET', path: '/a', credentials: 'none', expect: [{ schema: '#/components/schemas/A' }] }] });

	it('needs an OpenAPI document when a test checks schemas', () => {
		expect(approvalProblems([{ test_id: 'A-1', kind: 'automated', definition: withSchema }])).toEqual([
			'Some tests check responses against schemas, but the suite names no OpenAPI document.'
		]);
		expect(approvalProblems([{ test_id: 'A-1', kind: 'automated', definition: withSchema }], { openapi_url: 'https://reg/a.json' })).toEqual([]);
	});
});

describe('nextTestId', () => {
	it('starts at 001 with the suite code', () => {
		expect(nextTestId('AIS-PROVIDER', [])).toBe('AIS-PROVIDER-001');
	});

	it('follows the highest number with that code, ignoring other IDs', () => {
		expect(nextTestId('AIS-PROVIDER', ['AIS-PROVIDER-002', 'AIS-PROVIDER-010', 'PIS-IDEM-004', 'AIS-PROVIDER-X'])).toBe('AIS-PROVIDER-011');
	});

	it('always gives an ID that fits the test ID rule', () => {
		for (const code of ['ais-provider', 'A-B-C-D-E', 'VERYLONGGROUPNAMEHERE-X', 'X', '', '--', 'BG_1.3'])
			expect(isTestId(nextTestId(code, [])), code).toBe(true);
		expect(nextTestId('A-B-C-D-E', [])).toBe('TEST-001');
		expect(nextTestId('AB-C-D-E', [])).toBe('AB-C-D-001');
	});
});

describe('suggestSuite', () => {
	const fits = (code: string) => /^[A-Z0-9-]{2,32}$/.test(code);

	it('names a suite after the standard and version OBP implements', () => {
		expect(suggestSuite({ kind: 'obp_version', standard: 'obp', shortVersion: 'v5.1.0', label: 'Open Bank Project v5.1.0' }, [])).toEqual({ code: 'OBP-5-1-0', name: 'Open Bank Project v5.1.0' });
		expect(suggestSuite({ kind: 'obp_version', standard: 'BG', shortVersion: 'v1.3', label: 'Berlin Group v1.3' }, []).code).toBe('BG-1-3');
	});

	it("uses an OpenAPI document's title, or its file name when it has none", () => {
		expect(suggestSuite({ kind: 'openapi_dynamic', title: 'NextGenPSD2 XS2A Framework', fileName: 'psd2-api.yaml' }, [])).toEqual({ code: 'NEXTGENPSD-XS2A-FRAMEWORK', name: 'NextGenPSD2 XS2A Framework' });
		expect(suggestSuite({ kind: 'openapi_url', fileName: 'https://example.org/specs/account-info-openapi.json' }, [])).toEqual({ code: 'ACCOUNT-INFO-OPENAPI', name: 'account info openapi' });
	});

	it('suggests something even when nothing is known yet', () => {
		expect(suggestSuite({ kind: '' }, [])).toEqual({ code: 'MY-SUITE', name: 'My suite' });
		expect(suggestSuite({ kind: 'openapi_dynamic' }, [])).toEqual({ code: 'MY-SUITE', name: 'My suite' });
	});

	it('does not repeat a code another suite uses, and keeps every code valid', () => {
		expect(suggestSuite({ kind: '' }, ['MY-SUITE', 'my-suite-2']).code).toBe('MY-SUITE-3');
		const long = suggestSuite({ kind: 'openapi_url', title: 'Abcdefghijkl Mnopqrstuvwx Yzabcdefghij' }, ['ABCDEFGHIJ-MNOPQRSTUV-YZABCDEFGH']);
		expect(long.code).toBe('ABCDEFGHIJ-MNOPQRSTUV-YZABCDEF-2');
		expect(fits(long.code)).toBe(true);
	});
});
