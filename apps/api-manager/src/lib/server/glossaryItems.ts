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
 * Server-side reads for the Dynamic Glossary Item pages.
 */
import { createLogger } from "@obp/shared/utils";
import { obp_requests } from "$lib/obp/requests";
import { fetchApiGlossary } from "$lib/server/apiGlossaryCache";
import type { GlossaryItem, GlossaryItemsPage } from "$lib/services/glossaryItems";

const logger = createLogger("GlossaryItemsServer");

export const GLOSSARY_ITEMS_PATH = "/obp/v7.0.0/glossary-items";

/** One page of Dynamic Glossary Items, straight from v7.0.0. */
export async function loadGlossaryItems(
  token: string,
  params: { title?: string; limit?: number; offset?: number } = {},
): Promise<GlossaryItemsPage> {
  const query = new URLSearchParams();
  if (params.title) query.set("title", params.title);
  query.set("limit", String(params.limit ?? 100));
  query.set("offset", String(params.offset ?? 0));
  const resp = await obp_requests.get(`${GLOSSARY_ITEMS_PATH}?${query}`, token);
  return {
    glossary_items: (resp?.glossary_items ?? []) as GlossaryItem[],
    pagination: resp?.pagination ?? { total: 0, limit: params.limit ?? 100, offset: params.offset ?? 0 },
  };
}

/**
 * Titles of the static Glossary Items only, so the create form can say that a title would shadow
 * shipped text — and that OBP will refuse the write unless the override is declared.
 *
 * v7's Glossary flags each entry's provenance, so this is the served Glossary filtered by
 * `is_dynamic`, not an inference. Best effort: an empty list just means no warning is offered,
 * and OBP still refuses an undeclared collision with OBP-30577.
 */
export async function loadStaticGlossaryTitles(token: string): Promise<string[]> {
  try {
    const { items } = await fetchApiGlossary(token);
    return items.filter((i) => !i.is_dynamic).map((i) => i.title);
  } catch (e) {
    logger.warn("Could not load the glossary for static titles:", e);
    return [];
  }
}
