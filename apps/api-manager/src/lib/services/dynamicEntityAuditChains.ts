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
 * Dynamic Entity audit chains: tamper-evident records of every change to the records of one Dynamic Entity. Each entity's chain is managed at /management/banks/BANK_ID/dynamic-entities/DYNAMIC_ENTITY_ID/audit-chain, where BANK_ID is a bank's id or SYS for the system space. The root audit chain, at /management/dynamic-entity-audit-chains/root, ties every entity's chain together. Browser calls go through the generic OBP proxy; server loads use these paths directly.
 */

export const ROOT_CHAIN_PATH = "/obp/v7.0.0/management/dynamic-entity-audit-chains/root";

/** `/obp/v7.0.0/management/banks/BANK_ID/dynamic-entities/DYNAMIC_ENTITY_ID/audit-chain` */
export function entityChainPath(bankId: string, dynamicEntityId: string): string {
  return `/obp/v7.0.0/management/banks/${encodeURIComponent(bankId)}/dynamic-entities/${encodeURIComponent(dynamicEntityId)}/audit-chain`;
}

/** The page of one entity's audit chain in this app. */
export function entityChainPageHref(bankId: string, dynamicEntityId: string): string {
  return `/dynamic-entity-audit-chains/${encodeURIComponent(bankId)}/${encodeURIComponent(dynamicEntityId)}`;
}

/** The Roles of an entity's chain, held at its space: a bank id, or SYS. */
export const ENTITY_CHAIN_ROLES = {
  create: "CanCreateDynamicEntityAuditChain",
  get: "CanGetDynamicEntityAuditChain",
} as const;

/** The Roles of the root chain, held at no bank. */
export const ROOT_CHAIN_ROLES = {
  get: "CanGetDynamicEntityAuditRootChain",
  seal: "CanSealDynamicEntityAuditRootChain",
} as const;

export interface AuditChain {
  chain_id: string;
  bank_id: string;
  dynamic_entity_id: string;
  entity_name: string;
  hash_format: string;
  started_at: string;
  started_by_user_id: string;
  started_by_on_behalf_of_user_id: string;
  last_sequence: number;
  last_hash: string;
}

/** One entry of a chain. Every string is given exactly as it went into the entry's hash. */
export interface AuditChainEntry {
  sequence: number;
  operation: string;
  record_id: string;
  owner_user_id: string;
  /** The record as it was saved; left out for STARTED and for deletions. */
  data?: unknown;
  data_hash: string;
  data_json?: string;
  user_id: string;
  on_behalf_of_user_id: string;
  recorded_at: string;
  recorded_at_epoch_millis: number;
  previous_hash: string;
  hash: string;
}

/** What the check of one entity's chain found. */
export interface EntityChainCheck {
  is_intact: boolean;
  entries_checked: number;
  records_checked: number;
  last_sequence: number;
  last_hash: string;
  problem_count: number;
  problems: AuditChainProblem[];
  checked_at: string;
}

/** One problem a check found. chain_id names the entity's chain, for a problem found inside one. */
export interface AuditChainProblem {
  sequence?: number;
  record_id?: string;
  problem: string;
  chain_id?: string;
}

export interface RootChainCheck {
  is_intact: boolean;
  entries_checked: number;
  chains_checked: number;
  last_sequence: number;
  last_hash: string;
  problem_count: number;
  problems: AuditChainProblem[];
  checked_at: string;
}

export interface RootChainSeal {
  chains_sealed: number;
  root_chain: AuditChain;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return body?.message ?? `${fallback} (HTTP ${response.status})`;
}

async function send<T>(method: string, path: string, fallback: string): Promise<T> {
  const response = await fetch(`/proxy${path}`, { method, credentials: "include" });
  if (!response.ok) throw new Error(await readError(response, fallback));
  return response.json();
}

/**
 * Checks the root chain and every entity's chain against what it recorded. With includeChains, each entity's chain is also checked in full, records included, which takes longer.
 */
export function checkRootChain(includeChains: boolean): Promise<RootChainCheck> {
  return send("GET", `${ROOT_CHAIN_PATH}/check?include_chains=${includeChains}`, "Failed to check the root audit chain");
}

/** Records in the root chain the last entry of every entity's chain that has changed since it was last recorded. */
export function sealRootChain(): Promise<RootChainSeal> {
  return send("POST", `${ROOT_CHAIN_PATH}/seal`, "Failed to seal the root audit chain");
}

/** Starts an entity's audit chain. It cannot be stopped afterwards. */
export function startEntityChain(bankId: string, dynamicEntityId: string): Promise<AuditChain> {
  return send("POST", entityChainPath(bankId, dynamicEntityId), "Failed to start the audit chain");
}

/** Checks an entity's chain from its first entry, and its current records against it. */
export function checkEntityChain(bankId: string, dynamicEntityId: string): Promise<EntityChainCheck> {
  return send("GET", `${entityChainPath(bankId, dynamicEntityId)}/check`, "Failed to check the audit chain");
}
