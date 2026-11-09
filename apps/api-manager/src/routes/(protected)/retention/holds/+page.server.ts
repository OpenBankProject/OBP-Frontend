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
import { fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { loadEntityNames } from "$lib/server/domainApis";
import { messageOf, retentionSpaces, retentionToken } from "$lib/server/retention";
import { RESOURCE_TYPES, retentionPath, retentionSpace, type RetentionHold } from "$lib/services/retention";

/** A space's legal holds: what no retention run may archive, anonymise or delete until the hold is released. */
export const load: PageServerLoad = async ({ locals, url }) => {
  const token = retentionToken(locals);
  const { bankId, bankIds } = await retentionSpaces(url, token);
  const active = url.searchParams.get("all") === "true" ? undefined : "true";
  let holds: RetentionHold[] = [];
  let loadError: string | null = null;
  try {
    holds = (await obp_requests.get(retentionPath(bankId, "retention-holds", { is_active: active, limit: 200 }), token))?.retention_holds ?? [];
  } catch (e) {
    loadError = messageOf(e);
  }
  const entityNames = await loadEntityNames(token, bankId).catch(() => [] as string[]);
  return { bankId, bankIds, holds, entityNames, showAll: !active, loadError };
};

export const actions: Actions = {
  place: async ({ locals, request, url }) => {
    const form = await request.formData();
    const s = (k: string) => String(form.get(k) ?? "").trim();
    const type = s("resource_type");
    if (!(RESOURCE_TYPES as readonly string[]).includes(type) || !s("reason")) return fail(400, { error: "A hold needs the kind of resource and a reason." });
    if (!s("resource_id") && !(type === "dynamic_entity_record" && s("entity_name"))) return fail(400, { error: "Give the resource id, or (for Dynamic Entity records) the Dynamic Entity to hold all of its records." });
    try {
      await obp_requests.post(
        retentionPath(retentionSpace(url.searchParams.get("bank_id")), "retention-holds"),
        { resource_type: type, ...(s("resource_id") ? { resource_id: s("resource_id") } : {}), ...(s("entity_name") ? { entity_name: s("entity_name") } : {}), reason: s("reason") },
        retentionToken(locals),
      );
    } catch (e) {
      return fail(400, { error: messageOf(e) });
    }
    return { message: "The hold is placed." };
  },
  release: async ({ locals, request, url }) => {
    const id = String((await request.formData()).get("retention_hold_id") ?? "");
    try {
      await obp_requests.delete(retentionPath(retentionSpace(url.searchParams.get("bank_id")), `retention-holds/${encodeURIComponent(id)}`), retentionToken(locals));
    } catch (e) {
      return fail(400, { error: messageOf(e) });
    }
    return { message: "The hold is released." };
  },
};
