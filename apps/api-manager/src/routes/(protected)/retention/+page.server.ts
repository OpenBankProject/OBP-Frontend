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
import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { loadEntityNames } from "$lib/server/domainApis";
import { messageOf, retentionSpaces, retentionToken } from "$lib/server/retention";
import { policyBodyFromForm, retentionPath, retentionSpace, type RetentionPolicy } from "$lib/services/retention";

/** The retention policies of a space, and the form for a new one. */
export const load: PageServerLoad = async ({ locals, url }) => {
  const token = retentionToken(locals);
  const { bankId, bankIds } = await retentionSpaces(url, token);
  let policies: RetentionPolicy[] = [];
  let loadError: string | null = null;
  try {
    policies = (await obp_requests.get(retentionPath(bankId, "retention-policies"), token))?.retention_policies ?? [];
  } catch (e) {
    loadError = messageOf(e);
  }
  const entityNames = await loadEntityNames(token, bankId).catch(() => [] as string[]);
  return { bankId, bankIds, policies, entityNames, loadError };
};

export const actions: Actions = {
  create: async ({ locals, request, url }) => {
    const token = retentionToken(locals);
    const bankId = retentionSpace(url.searchParams.get("bank_id"));
    const parsed = policyBodyFromForm(await request.formData());
    if ("error" in parsed) return fail(400, { error: parsed.error });
    let created: RetentionPolicy;
    try {
      created = await obp_requests.post(retentionPath(bankId, "retention-policies"), parsed.body, token);
    } catch (e) {
      return fail(400, { error: messageOf(e) });
    }
    redirect(303, `/retention/${encodeURIComponent(bankId)}/${encodeURIComponent(created.retention_policy_id)}`);
  },
};
