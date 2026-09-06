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
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';

// Convert PascalCase/camelCase to snake_case
function toSnakeCase(str: string): string {
	return str
		.replace(/([A-Z])/g, '_$1')
		.toLowerCase()
		.replace(/^_/, ''); // Remove leading underscore if present
}

export interface DynamicEntityWithData {
	dynamicEntityId: string;
	entityName: string;
	userId: string;
	bankId?: string;
	hasPersonalEntity: boolean;
	schema: Record<string, unknown>;
	data: Record<string, unknown>[] | null;
}

export async function load(event: RequestEvent) {
	try {
		const token = event.locals.session.data.oauth?.access_token;

		if (!token) {
			error(401, { message: 'Unauthorized: No access token found in session.' });
		}

		let dynamicEntitiesResponse;
		try {
			dynamicEntitiesResponse = await obp_requests.get(
				'/obp/v6.0.0/personal-dynamic-entities/available',
				token
			);
		} catch (e: unknown) {
			console.error('Failed to fetch personal dynamic entities:', e);
			return {
				dynamicEntities: [],
				fetchError: e instanceof Error ? e.message : String(e)
			};
		}

		const rawEntities = dynamicEntitiesResponse?.dynamic_entities || [];

		// Parse entities - API returns snake_case fields
		const entitiesWithData: DynamicEntityWithData[] = [];

		for (const raw of rawEntities) {
			const entity: DynamicEntityWithData = {
				dynamicEntityId: String(raw.dynamic_entity_id || ''),
				entityName: String(raw.entity_name || ''),
				userId: String(raw.user_id || ''),
				bankId: raw.bank_id ? String(raw.bank_id) : undefined,
				hasPersonalEntity: Boolean(raw.has_personal_entity),
				schema: (raw.schema as Record<string, unknown>) || {},
				data: null
			};

			if (entity.entityName) {
				try {
					const dataPath = entity.bankId
						? `/obp/dynamic-entity/banks/${entity.bankId}/my/${entity.entityName}`
						: `/obp/dynamic-entity/my/${entity.entityName}`;
					const dataResponse = await obp_requests.get(
						dataPath,
						token
					);
					// API returns list key in snake_case format
					const listKey = `${toSnakeCase(entity.entityName)}_list`;
					entity.data = dataResponse[listKey] || [];
				} catch {
					entity.data = [];
				}
			}

			entitiesWithData.push(entity);
		}

		// Only include entities where the current user has data
		const entitiesWithRecords = entitiesWithData.filter(
			entity => entity.data && entity.data.length > 0
		);

		// Deduplicate by dynamicEntityId
		const uniqueEntities = entitiesWithRecords.filter(
			(entity, index, self) =>
				index === self.findIndex(e => e.dynamicEntityId === entity.dynamicEntityId)
		);

		return {
			dynamicEntities: uniqueEntities
		};
	} catch (e: unknown) {
		return {
			dynamicEntities: [],
			fetchError: e instanceof Error ? e.message : String(e)
		};
	}
}
