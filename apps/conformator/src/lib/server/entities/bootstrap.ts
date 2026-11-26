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
import { AUDITED_CENTRAL_ENTITIES, startAuditChains } from '../auditChains';

const logger = createLogger('ConformanceEntities');

/** Whether each central entity was found or created at the last attempt, and whether each audited one has its audit chain, for /setup. */
let lastResult: { at: string; entities: Record<string, boolean>; chains: Record<string, boolean> } | null = null;

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
 * Create the central entities, or add the properties they lack, then start the audit chains of the decision entities, as the app's own Consumer. Needs the Scopes listed on /setup; without them this logs why, and the setup page reports the entities or chains as missing. True when every entity exists and every chain is started.
 */
export async function ensureCentralEntities(): Promise<boolean> {
	const space = centralSpace();
	const token = (await requestApplicationAccessToken()).token;
	const entities = await ensureEntities(CENTRAL_ENTITIES, space, token);
	const entitiesOk = Object.values(entities).every(Boolean);
	if (!entitiesOk) logger.warn(`Some central entities are missing in space ${space}: ${JSON.stringify(entities)}`);
	// A chain can only be started on an entity that exists, so the chains wait for the entities.
	const chains = entitiesOk
		? await startAuditChains(space, AUDITED_CENTRAL_ENTITIES, token)
		: Object.fromEntries(AUDITED_CENTRAL_ENTITIES.map((name) => [name, false]));
	lastResult = { at: new Date().toISOString(), entities, chains };
	return entitiesOk && Object.values(chains).every(Boolean);
}
