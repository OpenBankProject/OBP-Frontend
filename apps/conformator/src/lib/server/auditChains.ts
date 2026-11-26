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
import { dynamicEntityDefinitionsPath } from '@obp/shared/obp';
import { obpRequests } from './obp';
import { messageOf } from './errors';
import {
	APPEAL,
	APPEAL_DECISION,
	APPROVAL,
	ASSESSMENT,
	PARTICIPANT_DECISION,
	REPORT,
	REPORT_EVENT,
	REVIEW_ASSIGNMENT,
	SUBMISSION,
	WAIVER_DECISION,
	WAIVER_REQUEST
} from './entities/definitions';

/**
 * The audit chains of Conformator's decisions. OBP-API keeps a hash chain for each Dynamic Entity that has one started: every record created, changed or deleted adds an entry, so a decision changed afterwards, or changed outside OBP-API, shows up when the chain is checked. A chain cannot be stopped, and its entity can no longer be deleted or renamed; adding properties to it still works. See the Glossary item "Dynamic Entity Audit Chains".
 */

const logger = createLogger('ConformatorAuditChains');

/** The central entities with an audit chain: participants' lifecycle decisions, and reports and what happened to them. */
export const AUDITED_CENTRAL_ENTITIES = [PARTICIPANT_DECISION, REPORT, REPORT_EVENT];

/**
 * The entities with an audit chain in each participant's space: what the participant submits for a decision, and every decision the regulator takes on it. Runs, results and evidence are not chained: there are many of them, and a submission is what the review decides on.
 */
export const AUDITED_PARTICIPANT_ENTITIES = [
	SUBMISSION,
	WAIVER_REQUEST,
	APPEAL,
	REVIEW_ASSIGNMENT,
	ASSESSMENT,
	WAIVER_DECISION,
	APPEAL_DECISION,
	APPROVAL
];

/** Starting an entity's chain needs this Role, or Scope, at the entity's space. */
export const START_CHAIN_ROLE = 'CanCreateDynamicEntityAuditChain';
/** Reading and checking the root chain, which covers every chain, needs this system Role. */
export const GET_ROOT_CHAIN_ROLE = 'CanGetDynamicEntityAuditRootChain';
/** Sealing the root chain needs this system Role. */
export const SEAL_ROOT_CHAIN_ROLE = 'CanSealDynamicEntityAuditRootChain';

const MANAGEMENT = '/obp/v7.0.0/management';
const ROOT = `${MANAGEMENT}/dynamic-entity-audit-chains/root`;

/** OBP-API's answer when an entity's chain was started before (OBP-09042). */
function alreadyStarted(err: unknown): boolean {
	return messageOf(err).includes('OBP-09042');
}

/** OBP-API's answer when there is no root chain yet, because no chain has been started (OBP-09045). */
function noRootChain(err: unknown): boolean {
	return messageOf(err).includes('OBP-09045');
}

/**
 * Start the audit chain of each named entity in a space, with the given token, and say for each whether it has one now. A chain started before counts as started. An entity that does not exist yet, or a refusal, counts as not started; the log says why. Safe to repeat.
 */
export async function startAuditChains(space: string, entityNames: string[], token: string | null): Promise<Record<string, boolean>> {
	const started: Record<string, boolean> = Object.fromEntries(entityNames.map((name) => [name, false]));
	if (!token) {
		logger.warn(`Cannot start the audit chains in ${space}: no access token.`);
		return started;
	}
	let ids: Map<string, string>;
	try {
		const response = await obpRequests.get(dynamicEntityDefinitionsPath(space), token);
		ids = new Map(
			(response?.dynamic_entities ?? []).map((e: { entity_name: string; dynamic_entity_id: string }) => [e.entity_name, e.dynamic_entity_id])
		);
	} catch (err) {
		logger.warn(`Cannot start the audit chains in ${space}: the dynamic entities could not be listed: ${messageOf(err)}`);
		return started;
	}
	for (const name of entityNames) {
		const dynamicEntityId = ids.get(name);
		if (!dynamicEntityId) {
			logger.warn(`Cannot start the audit chain of ${name} in ${space}: the entity does not exist yet.`);
			continue;
		}
		try {
			await obpRequests.post(`${MANAGEMENT}/banks/${encodeURIComponent(space)}/dynamic-entities/${encodeURIComponent(dynamicEntityId)}/audit-chain`, {}, token);
			logger.info(`Audit chain of ${name} in ${space} started.`);
			started[name] = true;
		} catch (err) {
			if (alreadyStarted(err)) started[name] = true;
			else logger.warn(`Could not start the audit chain of ${name} in ${space} (this needs ${START_CHAIN_ROLE} there): ${messageOf(err)}`);
		}
	}
	return started;
}

/** An audit chain as OBP-API describes it: the root chain, or one entity's. */
export interface AuditChain {
	chain_id: string;
	bank_id: string;
	dynamic_entity_id: string;
	entity_name: string;
	started_at: string;
	last_sequence: number;
	last_hash: string;
}

/** One problem a check found, with the entry, the record or the chain it is about. */
export interface AuditProblem {
	sequence?: number;
	record_id?: string;
	chain_id?: string;
	problem: string;
}

/** The result of checking the root chain and, with it, every entity's chain. */
export interface AuditCheck {
	is_intact: boolean;
	entries_checked: number;
	chains_checked: number;
	last_sequence: number;
	last_hash: string;
	problem_count: number;
	problems: AuditProblem[];
	checked_at: string;
}

/** A chain registered in the root chain, as its CHAIN_STARTED entry recorded it. */
export interface RegisteredChain {
	chain_id: string;
	bank_id: string;
	entity_name: string;
	started_at: string;
}

/** The root chain, or null when no chain has been started yet. */
export async function rootChain(token: string): Promise<AuditChain | null> {
	try {
		return await obpRequests.get(ROOT, token);
	} catch (err) {
		if (noRootChain(err)) return null;
		throw err;
	}
}

/**
 * Check the root chain and every entity's chain in full, records included. This reads every entry and record, so it takes longer as they grow. Null when no chain has been started yet.
 */
export async function checkAllChains(token: string): Promise<AuditCheck | null> {
	try {
		return await obpRequests.get(`${ROOT}/check?include_chains=true`, token);
	} catch (err) {
		if (noRootChain(err)) return null;
		throw err;
	}
}

/** The page size of the root chain's entries, which is OBP-API's largest. */
const ENTRIES_PAGE = 1000;

/**
 * Conformator's chains, from the root chain's CHAIN_STARTED entries: each chain's space and entity, oldest first. The root chain covers every Dynamic Entity on the OBP-API instance, so other apps' chains are left out.
 */
export async function conformatorChains(token: string): Promise<RegisteredChain[]> {
	const chains: RegisteredChain[] = [];
	for (let from = 0; ; ) {
		const page = await obpRequests.get(`${ROOT}/entries?from_sequence=${from}&limit=${ENTRIES_PAGE}`, token);
		const entries: Array<{ sequence: number; operation: string; record_id: string; recorded_at?: string; data?: Record<string, unknown> }> =
			page?.entries ?? [];
		for (const entry of entries) {
			const entityName = String(entry.data?.entity_name ?? '');
			if (entry.operation === 'CHAIN_STARTED' && entityName.startsWith('conformator_'))
				chains.push({ chain_id: entry.record_id, bank_id: String(entry.data?.bank_id ?? ''), entity_name: entityName, started_at: entry.recorded_at ?? '' });
		}
		if (entries.length < ENTRIES_PAGE) return chains;
		from = entries[entries.length - 1].sequence + 1;
	}
}

/**
 * Seal the root chain: record the last entry of every chain that changed since the last seal. The root chain's last_hash then covers every chain as it is now, and is the value to keep outside OBP.
 */
export async function sealRootChain(token: string): Promise<{ chains_sealed: number; root_chain: AuditChain }> {
	return obpRequests.post(`${ROOT}/seal`, {}, token);
}
