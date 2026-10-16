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
/** Server-side loads shared by the Dynamic Entity webhook pages. */
import { dynamicEntityDefinitionsPath } from "@obp/shared/obp";
import { obp_requests } from "$lib/obp/requests";
import { explorerResourceDocUrl } from "$lib/server/glossaryCache";
import { spaceOf, type WebhookEntity } from "$lib/services/dynamicEntityWebhooks";

/** The fields of a definition's schema and their declared types, e.g. approved -> boolean. */
function fieldTypesOf(definition: any): Record<string, string> {
  const properties = definition?.schema?.properties ?? {};
  return Object.fromEntries(
    Object.entries(properties).map(([name, property]: [string, any]) => [name, String(property?.type ?? "string")]),
  );
}

/** The Dynamic Entities of a space a webhook can be for, by name. */
export async function loadWebhookEntities(token: string, bankId: string): Promise<WebhookEntity[]> {
  const resp = await obp_requests.get(dynamicEntityDefinitionsPath(spaceOf(bankId)), token);
  return (resp?.dynamic_entities ?? [])
    .map((d: any) => ({
      dynamic_entity_id: d.dynamic_entity_id,
      entity_name: d.entity_name,
      bank_id: spaceOf(d.bank_id),
      field_types: fieldTypesOf(d),
    }))
    .sort((a: WebhookEntity, b: WebhookEntity) => a.entity_name.localeCompare(b.entity_name));
}

type Operation = "create" | "listAtBank" | "list" | "get" | "update" | "delete" | "test" | "deliveries" | "retry";

/** The v7.0.0 Dynamic Entity webhook endpoints, linked to their resource docs in the API Explorer. */
export function webhookExplorerEndpoints(ops: Operation[]) {
  const base = "/obp/v7.0.0/management/banks/BANK_ID/dynamic-entities/DYNAMIC_ENTITY_ID/web-hooks";
  const all: Record<Operation, { operation_id: string; verb: string; path: string }> = {
    create: { operation_id: "OBPv7.0.0-createDynamicEntityWebhook", verb: "POST", path: base },
    listAtBank: { operation_id: "OBPv7.0.0-getDynamicEntityWebhooksAtBank", verb: "GET", path: "/obp/v7.0.0/management/banks/BANK_ID/dynamic-entity-web-hooks" },
    list: { operation_id: "OBPv7.0.0-getDynamicEntityWebhooks", verb: "GET", path: base },
    get: { operation_id: "OBPv7.0.0-getDynamicEntityWebhook", verb: "GET", path: `${base}/WEBHOOK_ID` },
    update: { operation_id: "OBPv7.0.0-updateDynamicEntityWebhook", verb: "PUT", path: `${base}/WEBHOOK_ID` },
    delete: { operation_id: "OBPv7.0.0-deleteDynamicEntityWebhook", verb: "DELETE", path: `${base}/WEBHOOK_ID` },
    test: { operation_id: "OBPv7.0.0-testDynamicEntityWebhook", verb: "POST", path: `${base}/WEBHOOK_ID/test` },
    deliveries: { operation_id: "OBPv7.0.0-getDynamicEntityWebhookDeliveries", verb: "GET", path: `${base}/WEBHOOK_ID/deliveries` },
    retry: { operation_id: "OBPv7.0.0-retryDynamicEntityWebhookDelivery", verb: "POST", path: `${base}/WEBHOOK_ID/deliveries/EVENT_ID/retry` },
  };
  return ops.map((op) => ({ ...all[op], url: explorerResourceDocUrl(all[op].operation_id) }));
}
