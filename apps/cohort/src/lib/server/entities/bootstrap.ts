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
import { createLogger } from '@obp/shared/utils';
import { ensureDynamicEntity } from '@obp/shared/server/obp';
import { obpRequests } from '../obp';
import { requestApplicationAccessToken } from '../applicationToken';
import { cohortSpace } from '../space';
import { COHORT_ENTITIES } from './definitions';

const logger = createLogger('CohortEntities');

/** Whether each of Cohort's entities was found or created at the last attempt, for /setup. */
let lastResult: { at: string; entities: Record<string, boolean> } | null = null;

export function entitiesStatus() {
	return lastResult;
}

/**
 * Create Cohort's entities in its space, or add the properties they lack, as Cohort's own Consumer. Needs the
 * Scopes listed on /setup; without them this logs why and Cohort's pages report the entities as missing.
 */
export async function ensureCohortEntities(): Promise<boolean> {
	const tokenResult = await requestApplicationAccessToken();
	const accessToken = tokenResult.token;
	const space = cohortSpace();
	const entities: Record<string, boolean> = {};
	for (const definition of COHORT_ENTITIES) {
		entities[definition.entity_name] = await ensureDynamicEntity(definition, {
			accessToken,
			get: (path, token) => obpRequests.get(path, token),
			post: (path, body, token) => obpRequests.post(path, body, token),
			put: (path, body, token) => obpRequests.put(path, body, token)
		}, space);
	}
	lastResult = { at: new Date().toISOString(), entities };
	const ok = Object.values(entities).every(Boolean);
	if (!ok) logger.warn(`Some of Cohort's entities are missing in space ${space}: ${JSON.stringify(entities)}`);
	return ok;
}
