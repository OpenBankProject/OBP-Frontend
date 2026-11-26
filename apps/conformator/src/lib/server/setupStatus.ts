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
import { conformatorRequiredConsumerScopes } from '@obp/shared/obp';
import { obpRequests } from './obp';
import { consumerScopesCheck } from './consumerScopes';
import { centralSpace, runnerConsumerId } from './space';
import { apiManagerUrl, createBankUrl, platformAppsUrl } from './appDirectory';
import { entitiesStatus } from './entities/bootstrap';
import { CENTRAL_ENTITIES } from './entities/definitions';
import { AUDITED_CENTRAL_ENTITIES } from './auditChains';


const logger = createLogger('ConformanceSetup');

/** Whether a bank exists: true, false, or null when OBP-API could not be asked. */
export async function bankExists(bankId: string, token?: string): Promise<boolean | null> {
	try {
		await obpRequests.get(`/obp/v5.1.0/banks/${encodeURIComponent(bankId)}`, token);
		return true;
	} catch (err) {
		// OBP answers an unknown bank with an error body; no answer at all means it is unreachable.
		if (err instanceof Error && /OBP-\d+/.test(err.message)) return false;
		logger.warn(`Could not check bank ${bankId}:`, err);
		return null;
	}
}

/**
 * What an administrator needs to make Conformator work: its central space, its Consumer, whether OBP
 * accepted its Platform App declaration, which Scopes are held, and whether its entities exist. Reads the last
 * scheduled check; nothing here makes it check again.
 */
export async function setupStatus() {
	const space = centralSpace();
	const report = consumerScopesCheck.getReport();
	const consumerId = consumerScopesCheck.getConsumerId() ?? null;
	const manager = await apiManagerUrl();
	const exists = await bankExists(space);
	return {
		space,
		spaceExists: exists,
		createBankUrl: manager && exists === false ? createBankUrl(manager, space) : null,
		consumerId,
		declaration: consumerScopesCheck.getDeclaration(),
		state: report?.state ?? 'unknown',
		problem: report?.problem ?? null,
		checkedAt: report?.checked_at ?? null,
		scopes: report
			? report.scopes.map((s) => ({ role_name: s.role_name, bank_id: s.bank_id, needed_for: s.needed_for, held: report.state === 'unknown' ? null : s.held }))
			: conformatorRequiredConsumerScopes(space).map((s) => ({ ...s, held: null as boolean | null })),
		// null when the check could not read the Consumer's Scopes, so "none" is never claimed without knowing.
		excessScopes: report && report.state !== 'unknown' ? (report.excess ?? []) : null,
		entities: CENTRAL_ENTITIES.map((d) => ({ name: d.entity_name, ok: entitiesStatus()?.entities[d.entity_name] ?? null })),
		auditChains: AUDITED_CENTRAL_ENTITIES.map((name) => ({ name, ok: entitiesStatus()?.chains[name] ?? null })),
		entitiesCheckedAt: entitiesStatus()?.at ?? null,
		runnerConsumerId: runnerConsumerId() || null,
		apiManagerUrl: manager,
		platformAppsUrl: manager ? (consumerId ? platformAppsUrl(manager, consumerId) : `${manager}/consumers/platform-apps`) : null
	};
}
