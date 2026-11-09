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
import { DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID } from "@obp/shared/obp";

/**
 * Data retention at OBP-API: per space (a bank id, or SYS), policies say how long each kind of resource stays live
 * and whether it is then archived (read-only, for archive_days, then deleted), deleted, or (customers) anonymised.
 * Runs can be previewed, may need a second person's approval, skip resources under a legal hold, and are listed in a
 * disposal register. Nothing is restored from the archive. Archiving and deleting are each switched on by a prop.
 */

export const RESOURCE_TYPES = ["dynamic_entity_record", "file", "chat_message", "chat_room", "customer", "consent"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];
export const ACTIONS = ["archive", "delete", "anonymise"] as const;
export type RetentionAction = (typeof ACTIONS)[number];
export const RUN_STATUSES = ["pending", "running", "done", "refused", "failed"] as const;

/** The date a resource's period counts from, per resource type. */
export const DATE_BASES: Record<ResourceType, string[]> = {
  dynamic_entity_record: ["created", "updated", "field:"],
  file: ["created"],
  chat_message: ["created", "updated"],
  chat_room: ["created", "updated", "last_activity"],
  customer: ["created", "updated"],
  consent: ["expires", "created", "updated"],
};

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  dynamic_entity_record: "Dynamic Entity records",
  file: "Files",
  chat_message: "Chat messages",
  chat_room: "Chat rooms",
  customer: "Customers",
  consent: "Consents",
};

export const RETENTION_ROLES = {
  manage: "CanManageRetentionPolicy",
  getPolicies: "CanGetRetentionPolicies",
  run: "CanRunRetentionPolicy",
  approve: "CanApproveRetentionRun",
  getRuns: "CanGetRetentionRuns",
  holds: "CanManageRetentionHold",
  archive: "CanGetRetentionArchive",
} as const;

export interface RetentionPolicy {
  retention_policy_id: string;
  bank_id: string;
  name?: string;
  description?: string;
  resource_type: ResourceType;
  entity_name?: string;
  date_basis: string;
  condition?: { field: string; value: string };
  retain_days: number;
  archive_days?: number;
  action: RetentionAction;
  cascade: boolean;
  requires_approval: boolean;
  enabled: boolean;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface RetentionPreview {
  cutoff_date: string;
  matched_count: number;
  held_count: number;
  due_count: number;
  oldest_trigger_date?: string;
  sample_resource_ids: string[];
  archive_entries_due_count: number;
  count_is_capped: boolean;
  max_items_per_run: number;
  /** retention.minimum_retain_days: nothing is disposed of sooner than this after its trigger date. Absent from older OBP-API. */
  minimum_retain_days?: number;
  archive_enabled: boolean;
  delete_enabled: boolean;
  can_execute: boolean;
  requires_approval: boolean;
}

export interface RetentionRun {
  retention_run_id: string;
  retention_policy_id?: string;
  bank_id: string;
  mode: string;
  status: string;
  requested_by_user_id?: string;
  approved_by_user_id?: string;
  approval_decision?: string;
  approval_comment?: string;
  matched_count: number;
  archived_count: number;
  anonymised_count: number;
  deleted_count: number;
  held_count: number;
  failed_count: number;
  requested_at: string;
  started_at?: string;
  ended_at?: string;
  message: string;
}

export interface RetentionRunItem {
  retention_run_item_id: string;
  resource_type: string;
  resource_id: string;
  entity_name?: string;
  owner_user_id?: string;
  action: string;
  parent_resource_type?: string;
  parent_resource_id?: string;
  retention_archive_id?: string;
  disposed_at: string;
}

export interface RetentionHold {
  retention_hold_id: string;
  bank_id: string;
  resource_type: string;
  resource_id?: string;
  entity_name?: string;
  reason: string;
  placed_by_user_id: string;
  placed_at: string;
  released_by_user_id?: string;
  released_at?: string;
  is_active: boolean;
}

export interface RetentionArchiveEntry {
  retention_archive_id: string;
  retention_policy_id?: string;
  retention_run_id: string;
  bank_id: string;
  resource_type: string;
  resource_id: string;
  entity_name?: string;
  owner_user_id?: string;
  parent_resource_type?: string;
  parent_resource_id?: string;
  archived_at: string;
  delete_after?: string;
  has_content: boolean;
  content_size_in_bytes?: number;
  data?: unknown;
  content_base64?: string;
}

/** The space a page works on: a bank id, or SYS when none is given. */
export function retentionSpace(bankId: string | null | undefined): string {
  return bankId?.trim() || DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID;
}

/** `/obp/v7.0.0/management/banks/BANK_ID/<rest>` */
export function retentionPath(bankId: string, rest: string, query?: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== "") params.set(k, String(v));
  const qs = params.toString();
  return `/obp/v7.0.0/management/banks/${encodeURIComponent(retentionSpace(bankId))}/${rest}${qs ? `?${qs}` : ""}`;
}

/** What a policy keeps and does, in one line. */
export function describePolicy(p: Pick<RetentionPolicy, "resource_type" | "entity_name" | "condition" | "retain_days" | "date_basis" | "action" | "archive_days" | "cascade">): string {
  const what = p.entity_name ? `${p.entity_name} records` : RESOURCE_LABELS[p.resource_type] ?? p.resource_type;
  const where = p.condition?.field ? ` where ${p.condition.field} = ${p.condition.value}` : "";
  const then =
    p.action === "archive"
      ? `archived for ${p.archive_days ?? "?"} days, then deleted`
      : p.action === "anonymise"
        ? "anonymised"
        : "deleted";
  return `${what}${where}: kept ${p.retain_days} days from ${p.date_basis}, then ${then}${p.cascade ? ", with attached files and links" : ""}.`;
}

/**
 * The JSON body for creating (or, with `update`, changing) a policy, from the policy form; an error message when the
 * form makes no sense. On a change, what the policy is about cannot change, so it is left out.
 */
export function policyBodyFromForm(form: FormData, update = false): { body: Record<string, unknown> } | { error: string } {
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const int = (k: string) => (s(k) === "" ? null : Number(s(k)));
  const type = s("resource_type");
  const action = s("action");
  const retain = int("retain_days");
  const archive = int("archive_days");
  if (!update && !(RESOURCE_TYPES as readonly string[]).includes(type)) return { error: "Choose what the policy is about." };
  if (!(ACTIONS as readonly string[]).includes(action)) return { error: "Choose archive, delete or anonymise." };
  if (retain === null || !Number.isInteger(retain) || retain < 1) return { error: "Days kept must be a whole number of at least 1." };
  if (action === "archive" && (archive === null || !Number.isInteger(archive) || archive < 1)) return { error: "Archiving needs the days to keep the archive copy." };
  if (action === "anonymise" && !update && type !== "customer") return { error: "Only customers can be anonymised." };
  if (!update && type === "dynamic_entity_record" && !s("entity_name")) return { error: "Choose the Dynamic Entity." };
  let dateBasis = s("date_basis") || "created";
  if (dateBasis === "field:") {
    if (!s("date_field")) return { error: "Name the date field of the record." };
    dateBasis = `field:${s("date_field")}`;
  }
  const field = s("condition_field");
  return {
    body: {
      ...(s("name") || update ? { name: s("name") } : {}),
      ...(s("description") || update ? { description: s("description") } : {}),
      ...(update ? {} : { resource_type: type, ...(type === "dynamic_entity_record" ? { entity_name: s("entity_name") } : {}) }),
      date_basis: dateBasis,
      ...(field ? { condition: { field, value: s("condition_value") } } : update ? { condition: { field: "", value: "" } } : {}),
      retain_days: retain,
      ...(action === "archive" ? { archive_days: archive } : {}),
      action,
      cascade: form.get("cascade") === "on",
      requires_approval: form.get("requires_approval") === "on",
      enabled: form.get("enabled") === "on",
    },
  };
}
