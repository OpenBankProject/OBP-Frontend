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
import type { PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { messageOf, retentionSpaces, retentionToken } from "$lib/server/retention";
import { RESOURCE_TYPES, retentionPath, type RetentionArchiveEntry } from "$lib/services/retention";

const PAGE = 50;

/** What a space's retention runs archived, read-only, with the archive Role. Filters narrow the list. */
export const load: PageServerLoad = async ({ locals, url }) => {
  const token = retentionToken(locals);
  const { bankId, bankIds } = await retentionSpaces(url, token);
  const q = (k: string) => url.searchParams.get(k)?.trim() ?? "";
  const filters = {
    resource_type: (RESOURCE_TYPES as readonly string[]).includes(q("resource_type")) ? q("resource_type") : "",
    resource_id: q("resource_id"),
    entity_name: q("entity_name"),
    owner_user_id: q("owner_user_id"),
  };
  const offset = Math.max(0, Number(q("offset")) || 0);
  let entries: RetentionArchiveEntry[] = [];
  let loadError: string | null = null;
  try {
    entries = (await obp_requests.get(retentionPath(bankId, "retention-archive", { ...filters, limit: PAGE, offset }), token))?.retention_archive_entries ?? [];
  } catch (e) {
    loadError = messageOf(e);
  }
  return { bankId, bankIds, filters, entries, offset, pageSize: PAGE, loadError };
};
