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
import { describe, it, expect } from 'vitest';
import { normalizeMyResources, myResourcesCovered } from './consentReuse';

describe('normalizeMyResources', () => {
	it('treats absent, null and empty as none', () => {
		expect(normalizeMyResources(undefined)).toBeNull();
		expect(normalizeMyResources(null)).toBeNull();
		expect(normalizeMyResources({})).toBeNull();
		expect(normalizeMyResources({ personal_dynamic_entities: [] })).toBeNull();
	});

	it('cleans a valid block, defaulting bank_id and deduping actions', () => {
		expect(
			normalizeMyResources({
				personal_dynamic_entities: [{ entity_name: 'notes', actions: ['read', 'read', 'write'] }]
			})
		).toEqual({ personal_dynamic_entities: [{ bank_id: '', entity_name: 'notes', actions: ['read', 'write'] }] });
	});

	it('rejects wrong shapes', () => {
		expect(normalizeMyResources('nope')).toBeUndefined();
		expect(normalizeMyResources({ personal_dynamic_entities: 'nope' })).toBeUndefined();
		expect(normalizeMyResources({ personal_dynamic_entities: [{ actions: ['read'] }] })).toBeUndefined();
		expect(normalizeMyResources({ personal_dynamic_entities: [{ entity_name: 'notes', actions: [] }] })).toBeUndefined();
		expect(normalizeMyResources({ personal_dynamic_entities: [{ entity_name: 'notes', actions: ['delete'] }] })).toBeUndefined();
	});
});

describe('myResourcesCovered', () => {
	const required = { personal_dynamic_entities: [{ bank_id: '', entity_name: 'notes', actions: ['read', 'write'] }] };

	it('is satisfied when nothing is required', () => {
		expect(myResourcesCovered(undefined, null)).toBe(true);
	});

	it('needs the same entity at the same bank with a superset of actions', () => {
		expect(myResourcesCovered({ personal_dynamic_entities: [{ bank_id: '', entity_name: 'notes', actions: ['read', 'write'] }] }, required)).toBe(true);
		expect(myResourcesCovered({ personal_dynamic_entities: [{ bank_id: '', entity_name: 'notes', actions: ['read'] }] }, required)).toBe(false);
		expect(myResourcesCovered({ personal_dynamic_entities: [{ bank_id: 'b1', entity_name: 'notes', actions: ['read', 'write'] }] }, required)).toBe(false);
		expect(myResourcesCovered({ personal_dynamic_entities: [{ bank_id: '', entity_name: 'other', actions: ['read', 'write'] }] }, required)).toBe(false);
		expect(myResourcesCovered(undefined, required)).toBe(false);
	});
});
