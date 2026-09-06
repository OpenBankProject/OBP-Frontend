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
import { dynamicEntityListKey, extractDynamicEntityRecords } from './dynamicEntityForm.js';

describe('dynamicEntityListKey', () => {
	it('handles lowercase snake_case names', () => {
		expect(dynamicEntityListKey('parcel')).toBe('parcel_list');
		expect(dynamicEntityListKey('activity_plan')).toBe('activity_plan_list');
	});

	it('snakifies CamelCase names the way OBP-API does', () => {
		expect(dynamicEntityListKey('PeronalFriends')).toBe('peronal_friends_list');
		expect(dynamicEntityListKey('FooBar')).toBe('foo_bar_list');
	});

	it('keeps dashes and splits acronym boundaries like Lift snakify', () => {
		expect(dynamicEntityListKey('OGCR-DynamicEntities-log')).toBe('ogcr-dynamic_entities-log_list');
	});

	it('strips trailing dashes/underscores before the _list suffix', () => {
		expect(dynamicEntityListKey('thing_')).toBe('thing_list');
		expect(dynamicEntityListKey('thing-')).toBe('thing_list');
	});
});

describe('extractDynamicEntityRecords', () => {
	const records = [{ parcel_id: 'p1' }, { parcel_id: 'p2' }];

	it('returns a bare array as-is', () => {
		expect(extractDynamicEntityRecords('parcel', records)).toEqual(records);
	});

	it('unwraps the OBP snakified _list key', () => {
		expect(extractDynamicEntityRecords('parcel', { parcel_list: records })).toEqual(records);
		expect(
			extractDynamicEntityRecords('PeronalFriends', { peronal_friends_list: records })
		).toEqual(records);
	});

	it('unwraps legacy data/records keys', () => {
		expect(extractDynamicEntityRecords('parcel', { data: records })).toEqual(records);
		expect(extractDynamicEntityRecords('parcel', { records })).toEqual(records);
	});

	it('falls back to any _list-suffixed array key', () => {
		expect(extractDynamicEntityRecords('WeirdName', { unexpected_key_list: records })).toEqual(
			records
		);
	});

	it('falls back to the first array-valued key', () => {
		expect(
			extractDynamicEntityRecords('WeirdName', { bank_id: 'b1', items: records })
		).toEqual(records);
	});

	it('ignores non-array values under candidate keys', () => {
		expect(
			extractDynamicEntityRecords('parcel', { parcel: { parcel_id: 'p1' }, parcel_list: records })
		).toEqual(records);
	});

	it('returns [] for empty or non-object responses', () => {
		expect(extractDynamicEntityRecords('parcel', null)).toEqual([]);
		expect(extractDynamicEntityRecords('parcel', undefined)).toEqual([]);
		expect(extractDynamicEntityRecords('parcel', 'nope')).toEqual([]);
		expect(extractDynamicEntityRecords('parcel', {})).toEqual([]);
	});
});
