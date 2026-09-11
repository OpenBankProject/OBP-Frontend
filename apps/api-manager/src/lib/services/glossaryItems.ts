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
 * Client-side helpers for Dynamic Glossary Items: Glossary Items held in the database and
 * maintained at runtime, as opposed to the static ones compiled into the API. A Dynamic Item
 * replaces a static one of the same title everywhere GET /obp/v4.0.0/api/glossary is served.
 *
 * Title is the resource key: it is set at creation and cannot be changed afterwards.
 * All calls go through the generic OBP proxy.
 */

/**
 * One item as v7.0.0 /glossary-items returns it.
 *
 * GET /api/glossary/TITLE falls back to the static Glossary Item when no Dynamic one has the
 * title, so the management fields are optional: a static Item is compiled into the API and has no
 * id, author or timestamps, and cannot be updated or deleted — only overridden. The list endpoint
 * Glossary is one collection; ?source=dynamic narrows it to the ones held in the database, where
 * all of these are present.
 */
export interface GlossaryItem {
  glossary_item_id?: string;
  title: string;
  description: { markdown: string; html: string };
  /** False when this is the static Item shipped with the API rather than a Dynamic one. */
  is_dynamic: boolean;
  /** What the operator declared: this item is meant to displace the static Item of this title. */
  overrides_static_item: boolean;
  /** What is true right now: a static Glossary Item of this title exists. */
  shadows_static_glossary_item: boolean;
  created_by_user_id?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * An item is shadowing shipped documentation without anyone having said so — which happens when a
 * static Item is added later with a title a Dynamic one already used. OBP reports these at startup.
 */
export function isUndeclaredShadow(item: {
  overrides_static_item: boolean;
  shadows_static_glossary_item: boolean;
}): boolean {
  return item.shadows_static_glossary_item && !item.overrides_static_item;
}

export interface GlossaryItemsPage {
  glossary_items: GlossaryItem[];
  pagination: { total: number; limit: number; offset: number };
}

export interface GlossaryItemFormValues {
  title: string;
  /** Markdown, the same flavour the static Glossary uses. */
  description: string;
  /**
   * Declares that this item is meant to displace the static Glossary Item of the same title.
   * Creating a colliding title without it is refused with OBP-30577, so shadowing shipped
   * documentation is never a side effect of picking a name that happened to be taken.
   */
  overrides_static_item: boolean;
}

export const GLOSSARY_ITEM_MAX_TITLE_LENGTH = 255;

const BASE = "/proxy/obp/v7.0.0/api/glossary";

export const EXAMPLE_DESCRIPTION = `The unique identifier of the Bank on this OBP instance.

Example value: gh.29.uk

See also [Bank](/glossary#Bank).`;

/**
 * The title travels as one path segment. http4s url-decodes segments, so dots and spaces are
 * fine ("Bank.bank_id"), but a slash would split the path however it is encoded.
 */
export function titleProblem(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "A title is required.";
  if (trimmed.length > GLOSSARY_ITEM_MAX_TITLE_LENGTH)
    return `The title must be ${GLOSSARY_ITEM_MAX_TITLE_LENGTH} characters or fewer (this one is ${trimmed.length}).`;
  if (trimmed.includes("/")) return "The title cannot contain a slash: it is used as the resource path.";
  return "";
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return body?.message ?? `${fallback} (HTTP ${response.status})`;
}

/** POST adds an Item at /api/glossary; PUT updates the description at /api/glossary/TITLE. */
export async function saveGlossaryItem(values: GlossaryItemFormValues, isUpdate: boolean): Promise<GlossaryItem> {
  const title = values.title.trim();
  // PUT leaves overrides_static_item alone when it is omitted, so send it either way: the form
  // always shows the operator what it is set to, and a silent divergence would be worse.
  const body = isUpdate
    ? { description: values.description, overrides_static_item: values.overrides_static_item }
    : { title, description: values.description, overrides_static_item: values.overrides_static_item };
  const response = await fetch(isUpdate ? `${BASE}/${encodeURIComponent(title)}` : BASE, {
    method: isUpdate ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await readError(response, "Failed to save the Dynamic Glossary Item"));
  return response.json();
}

export async function deleteGlossaryItem(title: string): Promise<void> {
  const response = await fetch(`${BASE}/${encodeURIComponent(title)}`, { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error(await readError(response, "Failed to delete the Dynamic Glossary Item"));
}
