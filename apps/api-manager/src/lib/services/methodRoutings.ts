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
 * Client-side helpers for method routings: the reference lists the form offers
 * (connector method names, connectors, bank ids), the OBP record shape, and the
 * conversion between OBP's parameters array and the JSON object text the form edits.
 */

export interface MethodRouting {
  method_routing_id?: string;
  method_name: string;
  connector_name: string;
  is_bank_id_exact_match: boolean;
  bank_id_pattern?: string;
  /** OBP returns [{key, value}]; the form edits a JSON object string. */
  parameters?: Array<{ key: string; value: string }> | string;
}

export interface MethodRoutingFormValues {
  method_routing_id?: string;
  method_name: string;
  connector_name: string;
  is_bank_id_exact_match: boolean;
  bank_id_pattern: string;
  /** JSON object text, e.g. {"url": "https://…"}; empty for none. */
  parameters: string;
}

export const emptyMethodRouting = (): MethodRoutingFormValues => ({
  method_name: "",
  connector_name: "",
  is_bank_id_exact_match: false,
  bank_id_pattern: "",
  parameters: "",
});

/** OBP's [{key, value}] (or an already-textual value) as pretty JSON object text. */
export function parametersToJsonText(params: MethodRouting["parameters"]): string {
  if (Array.isArray(params)) {
    if (params.length === 0) return "";
    const obj: Record<string, string> = {};
    for (const p of params) if (p && typeof p === "object" && "key" in p) obj[p.key] = p.value;
    return JSON.stringify(obj, null, 2);
  }
  if (typeof params === "string") return params.trim();
  return "";
}

export function routingToFormValues(routing: MethodRouting, keepId = true): MethodRoutingFormValues {
  return {
    ...(keepId && routing.method_routing_id ? { method_routing_id: routing.method_routing_id } : {}),
    method_name: routing.method_name ?? "",
    connector_name: routing.connector_name ?? "",
    is_bank_id_exact_match: !!routing.is_bank_id_exact_match,
    bank_id_pattern: routing.bank_id_pattern ?? "",
    parameters: parametersToJsonText(routing.parameters),
  };
}

export function isDefaultRouting(routing: MethodRouting): boolean {
  return !routing.method_routing_id;
}

async function getJson(url: string): Promise<any> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? `HTTP ${response.status} from ${url}`);
  }
  return response.json();
}

export async function fetchMethodRoutings(active: boolean): Promise<MethodRouting[]> {
  const data = await getJson(`/backend/integration/method-routings${active ? "?active=true" : ""}`);
  return Array.isArray(data) ? data : data.method_routings || data.items || [];
}

export async function fetchMethodNames(): Promise<string[]> {
  const data = await getJson("/proxy/obp/v6.0.0/system/connector-method-names");
  return Array.isArray(data) ? data : data.method_names || data.connector_method_names || [];
}

export async function fetchConnectorNames(): Promise<string[]> {
  const data = await getJson("/backend/system/connectors");
  return Array.isArray(data) ? data : data.connector_names || [];
}

export async function fetchBankIds(): Promise<string[]> {
  const data = await getJson("/proxy/obp/v6.0.0/banks");
  const banks = Array.isArray(data) ? data : data.banks || [];
  return banks.map((b: { bank_id?: string }) => b.bank_id).filter((id: string | undefined): id is string => !!id).sort();
}

export async function saveMethodRouting(values: MethodRoutingFormValues): Promise<any> {
  const response = await fetch("/backend/integration/method-routings", {
    method: values.method_routing_id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(values),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message ?? `HTTP ${response.status}`);
  return body;
}

export async function deleteMethodRouting(methodRoutingId: string): Promise<void> {
  const response = await fetch(`/backend/integration/method-routings?method_routing_id=${encodeURIComponent(methodRoutingId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message ?? `HTTP ${response.status}`);
  }
}
