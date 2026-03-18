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
	dataError?: string;
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

			if (entity.hasPersonalEntity && entity.entityName) {
				try {
					const dataResponse = await obp_requests.get(
						`/obp/dynamic-entity/my/${entity.entityName}`,
						token
					);
					// API returns list key in snake_case format
					const listKey = `${toSnakeCase(entity.entityName)}_list`;
					entity.data = dataResponse[listKey] || [];
				} catch (e: unknown) {
					entity.dataError = e instanceof Error ? e.message : String(e);
				}
			}

			entitiesWithData.push(entity);
		}

		// Filter to only include entities with hasPersonalEntity: true
		const personalEntities = entitiesWithData.filter(entity => entity.hasPersonalEntity);

		// Deduplicate by dynamicEntityId
		const uniqueEntities = personalEntities.filter(
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
