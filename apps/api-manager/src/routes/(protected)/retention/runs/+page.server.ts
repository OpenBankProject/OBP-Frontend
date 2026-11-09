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
import { messageOf, retentionSpaces, retentionToken } from "$lib/server/retention";
import { retentionPath, retentionSpace, RUN_STATUSES, type RetentionPolicy, type RetentionRun } from "$lib/services/retention";

/** A space's retention runs, newest first; those waiting for approval can be approved or rejected here. */
export const load: PageServerLoad = async ({ locals, url }) => {
  const token = retentionToken(locals);
  const { bankId, bankIds } = await retentionSpaces(url, token);
  const status = (RUN_STATUSES as readonly string[]).includes(url.searchParams.get("status") ?? "") ? url.searchParams.get("status")! : "";
  let runs: RetentionRun[] = [];
  let loadError: string | null = null;
  try {
    runs = (await obp_requests.get(retentionPath(bankId, "retention-runs", { status, limit: 100 }), token))?.retention_runs ?? [];
  } catch (e) {
    loadError = messageOf(e);
  }
  const policies: RetentionPolicy[] = await obp_requests.get(retentionPath(bankId, "retention-policies"), token).then((r) => r?.retention_policies ?? [], () => []);
  const policyNames = Object.fromEntries(policies.map((p) => [p.retention_policy_id, p.name || p.entity_name || p.resource_type]));
  return { bankId, bankIds, status, runs, policyNames, loadError, userId: (locals.session.data.user as { user_id?: string })?.user_id ?? "" };
};

export const actions: Actions = {
  /** Approve or reject a pending run; OBP-API refuses when the approver is the one who asked. */
  decide: async ({ locals, request, url }) => {
    const form = await request.formData();
    const runId = String(form.get("retention_run_id") ?? "");
    const decision = form.get("decision") === "approve" ? "approve" : "reject";
    const comment = String(form.get("comment") ?? "").trim();
    try {
      const run: RetentionRun = await obp_requests.put(
        retentionPath(retentionSpace(url.searchParams.get("bank_id")), `retention-runs/${encodeURIComponent(runId)}/approval`),
        { decision, ...(comment ? { comment } : {}) },
        retentionToken(locals),
      );
      return { message: decision === "approve" ? `Approved: the run is ${run.status}. ${run.message ?? ""}` : "Rejected: nothing was disposed of." };
    } catch (e) {
      return fail(400, { error: messageOf(e) });
    }
  },
};
