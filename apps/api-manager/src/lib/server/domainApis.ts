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
/** Server-side loads shared by the Domain API pages. */
import { dynamicEntityDefinitionsPath } from "@obp/shared/obp";
import { obp_requests } from "$lib/obp/requests";
import { explorerResourceDocUrl } from "$lib/server/glossaryCache";

/** The bank ids a space can be, sorted; SYS is offered separately by the pages. */
export async function loadBankIds(token: string): Promise<string[]> {
  const resp = await obp_requests.get("/obp/v6.0.0/banks", token);
  return (resp?.banks ?? []).map((b: { bank_id: string }) => b.bank_id).filter(Boolean).sort();
}

/** The Dynamic Entity names defined in a space, which a Domain API over it publishes. */
export async function loadEntityNames(token: string, bankId: string): Promise<string[]> {
  const resp = await obp_requests.get(dynamicEntityDefinitionsPath(bankId), token);
  return (resp?.dynamic_entities ?? []).map((e: { entity_name: string }) => e.entity_name).sort();
}

/** The v7.0.0 Domain API management endpoints, linked to their resource docs in the API Explorer. */
export function domainApiExplorerEndpoints(ops: ("create" | "list" | "get" | "update" | "delete")[]) {
  const all = {
    create: { operation_id: "OBPv7.0.0-createDomainApi", verb: "POST", path: "/obp/v7.0.0/management/banks/BANK_ID/domain-apis" },
    list: { operation_id: "OBPv7.0.0-getDomainApis", verb: "GET", path: "/obp/v7.0.0/management/banks/BANK_ID/domain-apis" },
    get: { operation_id: "OBPv7.0.0-getDomainApi", verb: "GET", path: "/obp/v7.0.0/management/banks/BANK_ID/domain-apis/DOMAIN_API_ID" },
    update: { operation_id: "OBPv7.0.0-updateDomainApi", verb: "PUT", path: "/obp/v7.0.0/management/banks/BANK_ID/domain-apis/DOMAIN_API_ID" },
    delete: { operation_id: "OBPv7.0.0-deleteDomainApi", verb: "DELETE", path: "/obp/v7.0.0/management/banks/BANK_ID/domain-apis/DOMAIN_API_ID" },
  };
  return ops.map((op) => ({ ...all[op], url: explorerResourceDocUrl(all[op].operation_id) }));
}
