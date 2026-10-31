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
import { describe, expect, it } from 'vitest';
import { eligibilityOf, isCallOpen, missingToSubmit, readApplicationForm } from './applications';

function form(entries: Record<string, string>): FormData {
	const f = new FormData();
	for (const [k, v] of Object.entries(entries)) f.set(k, v);
	return f;
}

describe('readApplicationForm', () => {
	it('reads text, numbers and checkboxes, and leaves out what is empty or invalid', () => {
		const values = readApplicationForm(
			form({ startup_name: ' Example Pay ', sector: '', stage: 'not-a-stage', team_size: '3', local_resident: 'on' })
		);
		expect(values).toEqual({ startup_name: 'Example Pay', team_size: 3, local_resident: true, incorporated_locally: false });
	});
});

describe('missingToSubmit', () => {
	it('names the fields still empty', () => {
		expect(missingToSubmit({ startup_name: 'X', sector: 'payments', stage: 'mvp', problem_statement: 'p', solution: 's' })).toEqual([
			'market_understanding'
		]);
	});
});

describe('eligibilityOf', () => {
	it('is eligible for a local resident or a locally incorporated business, else needs review', () => {
		expect(eligibilityOf({ local_resident: true })).toBe('eligible');
		expect(eligibilityOf({ incorporated_locally: true })).toBe('eligible');
		expect(eligibilityOf({ local_resident: false, incorporated_locally: false })).toBe('needs_review');
	});
});

describe('isCallOpen', () => {
	it('needs status open and today within the dates', () => {
		expect(isCallOpen({ status: 'open', opens_at: '2026-11-01', closes_at: '2026-12-15' }, '2026-11-20')).toBe(true);
		expect(isCallOpen({ status: 'open', closes_at: '2026-10-01' }, '2026-11-20')).toBe(false);
		expect(isCallOpen({ status: 'draft' }, '2026-11-20')).toBe(false);
	});
});
