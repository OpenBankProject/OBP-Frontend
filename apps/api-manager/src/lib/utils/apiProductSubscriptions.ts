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

/*
 * API Product Subscriptions (OBP-API v7.0.0) as the bank sees them: one consumer holding one
 * API Product, with a status. Bank staff approve, enrol, suspend, reinstate and cancel them.
 */

export type ApiProductSubscriptionStatus = "requested" | "active" | "past_due" | "suspended" | "cancelled";

export interface ApiProductSubscriptionAttribute {
  api_product_subscription_id: string;
  api_product_subscription_attribute_id: string;
  name: string;
  type: string;
  value: string;
  is_active?: boolean | null;
}

export interface ApiProductSubscription {
  api_product_subscription_id: string;
  bank_id: string;
  api_product_code: string;
  consumer_id: string;
  status: ApiProductSubscriptionStatus;
  start_date: string;
  end_date?: string | null;
  created_by_user_id: string;
  rate_limiting_id?: string | null;
  created_at: string;
  updated_at: string;
  attributes?: ApiProductSubscriptionAttribute[] | null;
}

export const SUBSCRIPTIONS_API_VERSION = "v7.0.0";

/** The Roles OBP-API checks at the product's bank. */
export const SUBSCRIPTION_ROLES = {
  get: "CanGetApiProductSubscriptionAtOneBank",
  create: "CanCreateApiProductSubscriptionAtOneBank",
  updateStatus: "CanUpdateApiProductSubscriptionStatusAtOneBank",
  delete: "CanDeleteApiProductSubscriptionAtOneBank",
} as const;

export const STATUS_LABELS: Record<ApiProductSubscriptionStatus, string> = {
  requested: "Requested",
  active: "Active",
  past_due: "Payment overdue",
  suspended: "Suspended",
  cancelled: "Cancelled",
};

export interface StatusAction {
  /** Button text, for example "Approve". */
  label: string;
  /** The status the subscription moves to. */
  targetStatus: ApiProductSubscriptionStatus;
  /** True when the action takes access away, so the page asks before doing it. */
  confirm: boolean;
}

const APPROVE: StatusAction = { label: "Approve", targetStatus: "active", confirm: false };
const REINSTATE: StatusAction = { label: "Reinstate", targetStatus: "active", confirm: false };
const SUSPEND: StatusAction = { label: "Suspend", targetStatus: "suspended", confirm: true };
const CANCEL: StatusAction = { label: "Cancel", targetStatus: "cancelled", confirm: true };

/**
 * The status changes a bank admin can make from each status. This follows the status machine in
 * OBP-API (ApiProductSubscriptionStatus.canTransition). The move from "active" to "past_due" and
 * back is left to the billing system, so it has no button here.
 */
export function allowedStatusActions(status: string): StatusAction[] {
  switch (status) {
    case "requested":
      return [APPROVE, CANCEL];
    case "active":
      return [SUSPEND, CANCEL];
    case "past_due":
      return [SUSPEND, CANCEL];
    case "suspended":
      return [REINSTATE, CANCEL];
    default:
      return [];
  }
}

/**
 * A date input value such as "2026-09-02" as the date OBP-API reads: midnight UTC, with no
 * milliseconds. OBP-API ignores a date with milliseconds and uses "now" instead.
 * Returns undefined for an empty or invalid value.
 */
export function toObpDate(value: string): string | undefined {
  const text = value.trim();
  if (!text) return undefined;
  const date = new Date(text.length === 10 ? `${text}T00:00:00Z` : text);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** The product attribute SELF_SUBSCRIBE; an absent attribute means true. */
export function productIsSelfSubscribe(attributes: Array<{ name?: string; value?: string; is_active?: boolean | null }> | undefined): boolean {
  const selfSubscribeAttribute = (attributes ?? []).find(
    (attribute) => attribute.name?.toUpperCase() === "SELF_SUBSCRIBE" && attribute.is_active !== false,
  );
  return selfSubscribeAttribute?.value?.trim().toLowerCase() !== "false";
}
