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
import {
	dynamicEntityDataPath,
	dynamicEntityDefinitionsPath,
	dynamicEntityOperationId,
	dynamicEntityRecordIdPlaceholder,
	dynamicEntityRecordsPath
} from './dynamicEntitySpace.js';

describe('dynamic entity space paths', () => {
	it('uses one v7.0.0 path for every space, SYS when no bank is given', () => {
		expect(dynamicEntityDefinitionsPath('ogcr')).toBe('/obp/v7.0.0/management/banks/ogcr/dynamic-entities');
		expect(dynamicEntityDefinitionsPath(null)).toBe('/obp/v7.0.0/management/banks/SYS/dynamic-entities');
		expect(dynamicEntityDataPath('SYS')).toBe('/obp/v7.0.0/banks/SYS/dynamic-entities');
		expect(dynamicEntityRecordsPath('ogcr', 'parcel')).toBe('/obp/v7.0.0/banks/ogcr/dynamic-entities/parcel');
	});
});

describe('dynamicEntityOperationId', () => {
	it('ends in the bank id for a bank entity', () => {
		expect(dynamicEntityOperationId('createparcel', 'ogcr')).toBe('OBPv7.0.0-dynamicEntity_createparcel_ogcr');
	});

	it('ends in an empty bank id for the system space', () => {
		expect(dynamicEntityOperationId('getparcelList', 'SYS')).toBe('OBPv7.0.0-dynamicEntity_getparcelList_');
		expect(dynamicEntityOperationId('getparcelList', undefined)).toBe('OBPv7.0.0-dynamicEntity_getparcelList_');
	});
});

describe('dynamicEntityRecordIdPlaceholder', () => {
	it('writes the record id as OBP-API resource docs do', () => {
		expect(dynamicEntityRecordIdPlaceholder('activity_co_benefit')).toBe('ACTIVITY_CO_BENEFIT_ID');
		expect(dynamicEntityRecordIdPlaceholder('PeronalFriends')).toBe('PERONAL_FRIENDS_ID');
		expect(dynamicEntityRecordIdPlaceholder('OGCR-DynamicEntities-log')).toBe('OGCR-DYNAMIC_ENTITIES-LOG_ID');
	});
});
