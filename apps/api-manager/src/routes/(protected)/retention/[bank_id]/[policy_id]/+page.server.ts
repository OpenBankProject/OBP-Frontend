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
import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { obp_requests } from "$lib/obp/requests";
import { loadBankIds } from "$lib/server/domainApis";
import { messageOf, retentionToken } from "$lib/server/retention";
import { policyBodyFromForm, retentionPath, type RetentionPolicy, type RetentionPreview, type RetentionRun } from "$lib/services/retention";

const policyPath = (bankId: string, id: string) => retentionPath(bankId, `retention-policies/${encodeURIComponent(id)}`);

/** One policy: what it does, what it would affect now, and its runs. */
export const load: PageServerLoad = async ({ locals, params }) => {
  const token = retentionToken(locals);
  const bankId = params.bank_id;
  let policy: RetentionPolicy;
  try {
    policy = await obp_requests.get(policyPath(bankId, params.policy_id), token);
  } catch (e) {
    throw error(404, messageOf(e));
  }
  const [preview, runs, bankIds] = await Promise.all([
    obp_requests.get(`${policyPath(bankId, params.policy_id)}/preview`, token).then((p) => ({ preview: p as RetentionPreview, error: null }), (e) => ({ preview: null, error: messageOf(e) })),
    obp_requests.get(retentionPath(bankId, "retention-runs", { retention_policy_id: params.policy_id, limit: 20 }), token).then((r) => (r?.retention_runs ?? []) as RetentionRun[], () => null),
    loadBankIds(token).catch(() => [] as string[]),
  ]);
  return { bankId, bankIds, policy, preview: preview.preview, previewError: preview.error, runs, entityNames: [] as string[] };
};

export const actions: Actions = {
  update: async ({ locals, params, request }) => {
    const parsed = policyBodyFromForm(await request.formData(), true);
    if ("error" in parsed) return fail(400, { form: "update", error: parsed.error });
    try {
      await obp_requests.put(policyPath(params.bank_id, params.policy_id), parsed.body, retentionToken(locals));
    } catch (e) {
      return fail(400, { form: "update", error: messageOf(e) });
    }
    return { form: "update", message: "The policy is saved." };
  },
  remove: async ({ locals, params }) => {
    try {
      await obp_requests.delete(policyPath(params.bank_id, params.policy_id), retentionToken(locals));
    } catch (e) {
      return fail(400, { form: "remove", error: messageOf(e) });
    }
    redirect(303, `/retention?bank_id=${encodeURIComponent(params.bank_id)}`);
  },
  /** Run now. OBP-API refuses when the props switch the action off, and records the refusal. */
  run: async ({ locals, params, request }) => {
    const mode = (await request.formData()).get("mode") === "preview" ? "preview" : "execute";
    try {
      const run: RetentionRun = await obp_requests.post(`${policyPath(params.bank_id, params.policy_id)}/runs`, { mode }, retentionToken(locals));
      return { form: "run", message: run.status === "pending" ? "The run is waiting for a second person's approval." : `Run ${run.status}: ${run.message || ""}`, runId: run.retention_run_id };
    } catch (e) {
      return fail(400, { form: "run", error: messageOf(e) });
    }
  },
};
