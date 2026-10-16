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
 * Dynamic Entity webhooks: URLs OBP sends a POST request to when records of one Dynamic Entity are
 * created, updated or deleted. The request carries identifiers only, never record values. Managed through
 * the v7.0.0 endpoints at /management/banks/BANK_ID/dynamic-entities/DYNAMIC_ENTITY_ID/web-hooks, where
 * BANK_ID is a bank's id or SYS for the system space. Browser calls go through the generic OBP proxy;
 * server loads use these paths directly.
 */
import { DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID } from "@obp/shared/obp";

export const WEBHOOK_EVENTS = ["CREATED", "UPDATED", "DELETED"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/** One field condition: the field changed, from `from` and to `to` where they are given. */
export interface FieldCondition {
  field: string;
  from?: unknown;
  to?: unknown;
}

export interface DynamicEntityWebhook {
  webhook_id: string;
  bank_id: string;
  dynamic_entity_id: string;
  entity_name: string;
  url: string;
  events: WebhookEvent[];
  field_conditions: FieldCondition[];
  is_active: boolean;
  /** Present only while the webhook is not active. */
  deactivated_reason?: string;
  description: string;
  signature_status: "signed" | "not_configured";
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

/** One request queued for a webhook, and how sending it has gone. */
export interface WebhookDelivery {
  event_id: string;
  event_name: string;
  record_id?: string;
  status: "PENDING" | "DELIVERED" | "STICKY";
  attempts: number;
  last_http_status?: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookFormValues {
  url: string;
  events: WebhookEvent[];
  field_conditions: FieldCondition[];
  is_active: boolean;
  description: string;
}

/** A Dynamic Entity a webhook can be for, with its fields and their declared types. */
export interface WebhookEntity {
  dynamic_entity_id: string;
  entity_name: string;
  bank_id: string;
  field_types: Record<string, string>;
}

/** The Roles that manage webhooks, all held at the space (a bank id, or SYS). */
export const WEBHOOK_ROLES = {
  create: "CanCreateDynamicEntityWebhook",
  get: "CanGetDynamicEntityWebhooks",
  update: "CanUpdateDynamicEntityWebhook",
  delete: "CanDeleteDynamicEntityWebhook",
} as const;

/** What each deactivated_reason means, for people. */
export const DEACTIVATED_REASONS: Record<string, string> = {
  TURNED_OFF: "Turned off by a person.",
  CIRCUIT_BREAKER: "Turned off by OBP: too many requests in a minute, which usually means the receiver writes back and fires it again.",
  ENTITY_FIELD_REMOVED: "Turned off by OBP: the entity no longer has a field one of its conditions names. Fix the conditions, then turn it back on.",
  ENTITY_FIELD_TYPE_CHANGED: "Turned off by OBP: a field one of its conditions names changed type. Check the conditions, then turn it back on.",
};

/** The space a page works on: a bank id, or SYS when none is given. */
export function spaceOf(bankId: string | null | undefined): string {
  return bankId?.trim() || DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID;
}

/** `/obp/v7.0.0/management/banks/BANK_ID/dynamic-entities/DYNAMIC_ENTITY_ID/web-hooks[/WEBHOOK_ID]` */
export function webhooksPath(bankId: string, dynamicEntityId: string, webhookId?: string): string {
  const base = `/obp/v7.0.0/management/banks/${encodeURIComponent(spaceOf(bankId))}/dynamic-entities/${encodeURIComponent(dynamicEntityId)}/web-hooks`;
  return webhookId ? `${base}/${encodeURIComponent(webhookId)}` : base;
}

/** `/obp/v7.0.0/management/banks/BANK_ID/dynamic-entity-web-hooks`: every webhook of a space. */
export function webhooksAtBankPath(bankId: string): string {
  return `/obp/v7.0.0/management/banks/${encodeURIComponent(spaceOf(bankId))}/dynamic-entity-web-hooks`;
}

/** The API Manager page of one webhook. */
export function webhookPageHref(webhook: Pick<DynamicEntityWebhook, "bank_id" | "dynamic_entity_id" | "webhook_id">): string {
  return `/dynamic-entity-webhooks/${encodeURIComponent(webhook.bank_id)}/${encodeURIComponent(webhook.dynamic_entity_id)}/${encodeURIComponent(webhook.webhook_id)}`;
}

/** Why OBP would refuse this url, as far as the page can tell, or "". OBP has the final say. */
export function urlProblem(url: string): string {
  if (!url) return "";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "It must be an absolute URL, e.g. https://receiver.example.com/hooks/obp.";
  }
  if (parsed.protocol !== "https:") return "It must use https.";
  if (parsed.username || parsed.password) return "It must not carry a user name or password.";
  return "";
}

/**
 * A condition value typed for its field: "true"/"false" for a boolean, a number for a number or integer,
 * the text itself otherwise. An empty input means "any value" and gives undefined.
 */
export function conditionValue(input: string, fieldType: string | undefined): unknown {
  if (input === "") return undefined;
  if (fieldType === "boolean") return input === "true";
  if (fieldType === "number" || fieldType === "integer") {
    const n = Number(input);
    return Number.isFinite(n) ? n : input;
  }
  return input;
}

/** A condition value as an input shows it. */
export function conditionInput(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

/** One condition in words, e.g. "approved from false to true". */
export function describeCondition(c: FieldCondition): string {
  const from = c.from === undefined ? "" : ` from ${JSON.stringify(c.from)}`;
  const to = c.to === undefined ? "" : ` to ${JSON.stringify(c.to)}`;
  return from || to ? `${c.field}${from}${to}` : `${c.field} changes`;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return body?.message ?? `${fallback} (HTTP ${response.status})`;
}

function bodyOf(values: WebhookFormValues): string {
  return JSON.stringify({
    url: values.url,
    events: values.events,
    field_conditions: values.field_conditions,
    is_active: values.is_active,
    description: values.description,
  });
}

async function send<T>(method: string, path: string, fallback: string, body?: string): Promise<T> {
  const response = await fetch(`/proxy${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    credentials: "include",
    body,
  });
  if (!response.ok) throw new Error(await readError(response, fallback));
  return response.status === 204 ? (undefined as T) : response.json();
}

export function createWebhook(bankId: string, dynamicEntityId: string, values: WebhookFormValues): Promise<DynamicEntityWebhook> {
  return send("POST", webhooksPath(bankId, dynamicEntityId), "Failed to create the webhook", bodyOf(values));
}

export function updateWebhook(bankId: string, dynamicEntityId: string, webhookId: string, values: WebhookFormValues): Promise<DynamicEntityWebhook> {
  return send("PUT", webhooksPath(bankId, dynamicEntityId, webhookId), "Failed to update the webhook", bodyOf(values));
}

export function deleteWebhook(bankId: string, dynamicEntityId: string, webhookId: string): Promise<void> {
  return send("DELETE", webhooksPath(bankId, dynamicEntityId, webhookId), "Failed to delete the webhook");
}

/** Queues a webhook.test request; the response is the queued delivery. */
export function testWebhook(bankId: string, dynamicEntityId: string, webhookId: string): Promise<WebhookDelivery> {
  return send("POST", `${webhooksPath(bankId, dynamicEntityId, webhookId)}/test`, "Failed to queue a test request", "");
}

/** Sends a STICKY delivery again; the response is the delivery, now PENDING. */
export function retryDelivery(bankId: string, dynamicEntityId: string, webhookId: string, eventId: string): Promise<WebhookDelivery> {
  return send("POST", `${webhooksPath(bankId, dynamicEntityId, webhookId)}/deliveries/${encodeURIComponent(eventId)}/retry`, "Failed to retry the delivery", "");
}

/** The deliveries of a webhook, newest first. */
export async function getDeliveries(bankId: string, dynamicEntityId: string, webhookId: string, status?: string, limit = 50): Promise<WebhookDelivery[]> {
  const query = new URLSearchParams({ limit: String(limit), ...(status ? { status } : {}) });
  const resp = await send<{ deliveries: WebhookDelivery[] }>("GET", `${webhooksPath(bankId, dynamicEntityId, webhookId)}/deliveries?${query}`, "Failed to load the deliveries");
  return resp?.deliveries ?? [];
}
