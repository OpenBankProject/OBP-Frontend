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

/**
 * The bank id of the system space in OBP's Dynamic Entities.
 *
 * Every Dynamic Entity lives in a space: a bank, or the system space, whose bank id is SYS. The
 * Roles that manage entity definitions (CanCreateDynamicEntityDefinition and its siblings) are
 * granted at the bank id of the space they cover, so a Role for the system space is held at SYS,
 * never at the empty bank id.
 */
export const DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID = "SYS";

/**
 * The v7.0.0 URL that manages the Dynamic Entity definitions in one space.
 *
 * From v7.0.0 there is one set of URLs for every space: `/management/banks/BANK_ID/dynamic-entities`,
 * where BANK_ID is a bank's id or SYS. List and create at this path; update and delete at
 * `/DYNAMIC_ENTITY_ID`, backup at `/DYNAMIC_ENTITY_ID/backup`, cascade delete at `/cascade/DYNAMIC_ENTITY_ID`.
 * Every response carries `bank_id`, SYS included. A missing bank id means the system space.
 */
export function dynamicEntityDefinitionsPath(bankId?: string | null): string {
	const space = bankId || DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID;
	return `/obp/v7.0.0/management/banks/${encodeURIComponent(space)}/dynamic-entities`;
}

/**
 * The v7.0.0 URL of one Dynamic Entity's records: `/obp/v7.0.0/banks/BANK_ID/dynamic-entities/ENTITY_NAME`,
 * BANK_ID a bank's id or SYS. What follows is what follows `/obp/dynamic-entity/` in the unversioned
 * URLs (`/RECORD_ID`, `/RECORD_ID/access`); `my/`, `public/` and `community/` go before the entity name.
 * A missing bank id means the system space.
 */
export function dynamicEntityRecordsPath(bankId: string | null | undefined, entityName: string): string {
	return `${dynamicEntityDataPath(bankId)}/${encodeURIComponent(entityName)}`;
}

/**
 * The v7.0.0 prefix of every record URL in one space: `/obp/v7.0.0/banks/BANK_ID/dynamic-entities`.
 * `ENTITY_NAME`, `my/ENTITY_NAME`, `public/ENTITY_NAME` and `community/ENTITY_NAME` follow it.
 */
export function dynamicEntityDataPath(bankId?: string | null): string {
	const space = bankId || DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID;
	return `/obp/v7.0.0/banks/${encodeURIComponent(space)}/dynamic-entities`;
}

/**
 * The v7.0.0 operation id of one of a Dynamic Entity's generated endpoints, for linking to its resource
 * doc in the API Explorer under `OBPv7.0.0`. OBP-API builds it as `OBPv7.0.0-dynamicEntity_<function>_<BANK_ID>`,
 * where `<function>` names the operation and the entity (`create<entity>`, `get<entity>List`,
 * `getSingle<entity>`, `update<entity>`, `delete<entity>`, `get<entity>RowAccess`, `grant<entity>RowAccess`,
 * `revoke<entity>RowAccess`), and BANK_ID is empty for the system space. Entities of the same name in two
 * spaces therefore have different ids. The doc it names is for the v7.0.0 URL, dynamicEntityRecordsPath.
 */
export function dynamicEntityOperationId(fn: string, bankId?: string | null): string {
	const suffix = bankId && bankId !== DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID ? bankId : '';
	return `OBPv7.0.0-dynamicEntity_${fn}_${suffix}`;
}

/**
 * The record id as OBP-API's resource docs write it in a path, e.g. `ACTIVITY_CO_BENEFIT_ID` for
 * `activity_co_benefit`: the entity's id field, snake_cased and upper-cased, as
 * `StringHelpers.snakify(idName).toUpperCase()` builds it in DynamicEntityHelper.
 */
export function dynamicEntityRecordIdPlaceholder(entityName: string): string {
	const snake = entityName
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
		.replace(/([a-z\d])([A-Z])/g, '$1_$2')
		.toLowerCase();
	return `${snake}_id`.toUpperCase();
}
