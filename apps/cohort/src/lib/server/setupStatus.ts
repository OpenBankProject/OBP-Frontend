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
import { cohortRequiredConsumerScopes } from '@obp/shared/obp';
import { obpRequests } from './obp';
import { consumerScopesCheck } from './consumerScopes';
import { cohortFormsSpace, cohortSpace } from './space';
import { apiManagerUrl, createBankUrl, platformAppsUrl } from './appDirectory';
import { entitiesStatus } from './entities/bootstrap';
import { COHORT_ENTITIES } from './entities/definitions';

const logger = createLogger('CohortSetup');

const SYSTEM_SPACE = 'SYS';
const BANK_CACHE_MS = 60 * 1000;
const bankChecked = new Map<string, { at: number; exists: boolean | null }>();

/** Whether the space's bank exists: true, false, or null when OBP-API could not be asked. SYS always exists. */
async function spaceExists(space: string): Promise<boolean | null> {
	if (space === SYSTEM_SPACE) return true;
	const cached = bankChecked.get(space);
	if (cached && Date.now() - cached.at < BANK_CACHE_MS) return cached.exists;
	let exists: boolean | null;
	try {
		await obpRequests.get(`/obp/v5.1.0/banks/${encodeURIComponent(space)}`);
		exists = true;
	} catch (err) {
		// OBP answers an unknown bank with an error body; no answer at all means it is unreachable.
		exists = err instanceof Error && /OBP-\d+/.test(err.message) ? false : null;
		if (exists === null) logger.warn(`Could not check bank ${space}:`, err);
	}
	bankChecked.set(space, { at: Date.now(), exists });
	return exists;
}

export interface SetupScope {
	role_name: string;
	bank_id: string;
	needed_for: string;
	held: boolean | null;
}

/**
 * What an administrator needs to make Cohort work: its space, its Consumer, whether OBP accepted its Platform
 * App declaration, and which Scopes are held. Reads the last scheduled check; nothing here makes it check again.
 */
export async function setupStatus() {
	const space = cohortSpace();
	const report = consumerScopesCheck.getReport();
	const consumerId = consumerScopesCheck.getConsumerId() ?? null;
	const manager = await apiManagerUrl();
	const scopes: SetupScope[] = report
		? report.scopes.map((s) => ({ role_name: s.role_name, bank_id: s.bank_id, needed_for: s.needed_for,
				held: report.state === 'unknown' ? null : s.held }))
		: cohortRequiredConsumerScopes(space).map((s) => ({ ...s, held: null }));
	const formsSpace = cohortFormsSpace();
	const [exists, formsExists] = await Promise.all([spaceExists(space), spaceExists(formsSpace)]);
	return {
		space,
		spaceExists: exists,
		createBankUrl: manager && exists === false ? createBankUrl(manager, space) : null,
		formsSpace,
		formsSpaceExists: formsExists,
		createFormsBankUrl: manager && formsExists === false ? createBankUrl(manager, formsSpace) : null,
		consumerId,
		declaration: consumerScopesCheck.getDeclaration(),
		state: report?.state ?? 'unknown',
		problem: report?.problem ?? null,
		checkedAt: report?.checked_at ?? null,
		scopes,
		entities: COHORT_ENTITIES.map((d) => ({
			name: d.entity_name,
			ok: entitiesStatus()?.entities[d.entity_name] ?? null
		})),
		entitiesCheckedAt: entitiesStatus()?.at ?? null,
		apiManagerUrl: manager,
		platformAppsUrl: manager ? (consumerId ? platformAppsUrl(manager, consumerId) : `${manager}/consumers/platform-apps`) : null
	};
}
