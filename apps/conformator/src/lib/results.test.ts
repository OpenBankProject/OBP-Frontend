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
import { summarise } from './results';

const tests = [
	{ test_id: 'A-001', mandatory: true },
	{ test_id: 'A-002', mandatory: true },
	{ test_id: 'A-003', mandatory: false },
	{ test_id: 'A-004', mandatory: false }
];

describe('summarise', () => {
	it('puts a failed mandatory test first, however many tests passed', () => {
		const s = summarise(
			[
				{ test_id: 'A-001', outcome: 'fail' },
				{ test_id: 'A-002', outcome: 'pass' },
				{ test_id: 'A-003', outcome: 'pass' },
				{ test_id: 'A-004', outcome: 'pass' }
			],
			tests
		);
		expect(s.headline).toBe('1 mandatory test failed.');
		expect(s.mandatoryFailed).toEqual(['A-001']);
		expect(s.percentPassed).toBe(75);
	});

	it('counts a mandatory test with no result, or blocked, as open, never as passed', () => {
		const s = summarise([{ test_id: 'A-001', outcome: 'blocked' }], tests);
		expect(s.mandatoryOpen).toEqual(['A-001', 'A-002']);
		expect(s.headline).toBe('2 mandatory tests have no pass or fail yet.');
		expect(s.percentPassed).toBe(0);
	});

	it('leaves tests approved as not applicable out of the share', () => {
		const s = summarise(
			[
				{ test_id: 'A-001', outcome: 'pass' },
				{ test_id: 'A-002', outcome: 'not_applicable' },
				{ test_id: 'A-003', outcome: 'pass' },
				{ test_id: 'A-004', outcome: 'fail' }
			],
			tests
		);
		expect(s.headline).toBe('Every mandatory test passed.');
		expect(s.percentPassed).toBe(66);
		expect(s.counts).toEqual({ pass: 2, fail: 1, blocked: 0, not_executed: 0, not_applicable: 1 });
	});
});
