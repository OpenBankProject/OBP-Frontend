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
/** Server-side helpers for the audit chain page. */
import { explorerResourceDocUrl } from "$lib/server/glossaryCache";
import { ROOT_CHAIN_PATH } from "$lib/services/dynamicEntityAuditChains";

/** The v7.0.0 root audit chain endpoints, linked to their resource docs in the API Explorer. */
export function rootChainExplorerEndpoints() {
  return [
    { operation_id: "OBPv7.0.0-getDynamicEntityAuditRootChain", verb: "GET", path: ROOT_CHAIN_PATH },
    { operation_id: "OBPv7.0.0-checkDynamicEntityAuditRootChain", verb: "GET", path: `${ROOT_CHAIN_PATH}/check` },
    { operation_id: "OBPv7.0.0-sealDynamicEntityAuditRootChain", verb: "POST", path: `${ROOT_CHAIN_PATH}/seal` },
    { operation_id: "OBPv7.0.0-getDynamicEntityAuditRootChainEntries", verb: "GET", path: `${ROOT_CHAIN_PATH}/entries` },
  ].map((endpoint) => ({ ...endpoint, url: explorerResourceDocUrl(endpoint.operation_id) }));
}

/** The v7.0.0 endpoints of one entity's audit chain, linked to their resource docs in the API Explorer. */
export function entityChainExplorerEndpoints() {
  const base = "/obp/v7.0.0/management/banks/BANK_ID/dynamic-entities/DYNAMIC_ENTITY_ID/audit-chain";
  return [
    { operation_id: "OBPv7.0.0-startDynamicEntityAuditChain", verb: "POST", path: base },
    { operation_id: "OBPv7.0.0-getDynamicEntityAuditChain", verb: "GET", path: base },
    { operation_id: "OBPv7.0.0-getDynamicEntityAuditChainEntries", verb: "GET", path: `${base}/entries` },
    { operation_id: "OBPv7.0.0-checkDynamicEntityAuditChain", verb: "GET", path: `${base}/check` },
  ].map((endpoint) => ({ ...endpoint, url: explorerResourceDocUrl(endpoint.operation_id) }));
}
