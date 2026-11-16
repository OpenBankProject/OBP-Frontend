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
import { createLogger } from '@obp/shared/utils';
import { ensureDynamicEntity, type SystemDynamicEntityDefinition } from '@obp/shared/server/obp';
import { obpRequests } from '../obp';
import { requestApplicationAccessToken } from '../applicationToken';
import { centralSpace } from '../space';
import { CENTRAL_ENTITIES } from './definitions';

const logger = createLogger('ConformanceEntities');

/** Whether each central entity was found or created at the last attempt, for /setup. */
let lastResult: { at: string; entities: Record<string, boolean> } | null = null;

export function entitiesStatus() {
	return lastResult;
}

/** Create the given entities in a space, or add the properties they lack, with the given token. */
export async function ensureEntities(
	definitions: SystemDynamicEntityDefinition[],
	space: string,
	accessToken: string | null
): Promise<Record<string, boolean>> {
	const deps = {
		accessToken,
		get: (path: string, token: string) => obpRequests.get(path, token),
		post: (path: string, body: unknown, token: string) => obpRequests.post(path, body, token),
		put: (path: string, body: unknown, token: string) => obpRequests.put(path, body, token)
	};
	const entities: Record<string, boolean> = {};
	for (const definition of definitions) entities[definition.entity_name] = await ensureDynamicEntity(definition, deps, space);
	return entities;
}

/**
 * Create the central entities, or add the properties they lack, as the app's own Consumer. Needs the Scopes listed on
 * /setup; without them this logs why and the setup page reports the entities as missing.
 */
export async function ensureCentralEntities(): Promise<boolean> {
	const space = centralSpace();
	const entities = await ensureEntities(CENTRAL_ENTITIES, space, (await requestApplicationAccessToken()).token);
	lastResult = { at: new Date().toISOString(), entities };
	const ok = Object.values(entities).every(Boolean);
	if (!ok) logger.warn(`Some central entities are missing in space ${space}: ${JSON.stringify(entities)}`);
	return ok;
}
