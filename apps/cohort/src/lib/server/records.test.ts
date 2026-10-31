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
import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { OBP_ENTITY_SPACE_ID: 'cohort' } }));
vi.mock('./obp', () => ({ obpRequests: {} }));

const { idOf, unwrapList } = await import('./records');

describe('unwrapList', () => {
	it('unwraps v7.0.0 list items', () => {
		const response = { bank_id: 'cohort', cohort_call_list: [{ cohort_call: { cohort_call_id: 'c1' }, metadata: {} }] };
		expect(unwrapList('cohort_call', response)).toEqual([{ cohort_call_id: 'c1' }]);
	});
	it('is empty when there is no list', () => {
		expect(unwrapList('cohort_call', {})).toEqual([]);
	});
});

describe('idOf', () => {
	it('reads <entity>_id', () => {
		expect(idOf('cohort_call', { cohort_call_id: 'c1' })).toBe('c1');
	});
});
