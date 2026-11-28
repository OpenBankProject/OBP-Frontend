<!--
  Copyright (C) 2025-2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import SpaceRoleAlerts from "$lib/components/SpaceRoleAlerts.svelte";
  import RetentionHeader from "$lib/components/retention/RetentionHeader.svelte";
  import { RETENTION_ROLES, RUN_STATUSES } from "$lib/services/retention";

  let { data, form } = $props();
  const when = (v?: string) => (v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }) : "—");
  const th = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted";
  function chooseStatus(e: Event) {
    const status = (e.currentTarget as HTMLSelectElement).value;
    goto(`/retention/runs?bank_id=${encodeURIComponent(data.bankId)}${status ? `&status=${status}` : ""}`);
  }
</script>

<svelte:head>
  <title>Retention Runs - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <RetentionHeader title="Retention Runs" intro="Every run of this space's retention policies, by a person or by the scheduler. A run that needs approval waits here for a second person; the one who asked cannot approve it." bankId={data.bankId} bankIds={data.bankIds} />

  <SpaceRoleAlerts bankId={data.bankId} roles={[
    { role: RETENTION_ROLES.getRuns, purpose: "to see its retention runs" },
    { role: RETENTION_ROLES.approve, purpose: "to approve or reject runs" },
  ]} />

  {#if data.loadError}<div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="load-error">{data.loadError}</div>{/if}
  {#if form?.error}<div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="action-error">{form.error}</div>{/if}
  {#if form?.message}<div class="mb-6 rounded-lg border p-4 text-sm ui-tone-success" role="status" data-testid="message">{form.message}</div>{/if}

  <div class="mb-4 flex items-center gap-2 text-sm">
    <label for="status" class="ui-muted">Status</label>
    <select id="status" value={data.status} onchange={chooseStatus} class="rounded-lg border px-3 py-1.5 text-sm ui-card ui-text ui-border" data-testid="status-select">
      <option value="">Any</option>
      {#each RUN_STATUSES as s (s)}<option value={s}>{s}</option>{/each}
    </select>
  </div>

  <div class="overflow-x-auto rounded-lg border shadow-sm ui-card ui-border">
    {#if data.runs.length === 0}
      <div class="p-8 text-center text-sm ui-muted" data-testid="empty">No retention runs in {data.bankId}.</div>
    {:else}
      <table class="w-full text-sm" data-testid="runs-table">
        <thead class="ui-card"><tr><th class={th}>Requested</th><th class={th}>Policy</th><th class={th}>Mode</th><th class={th}>Status</th><th class={th}>Result</th><th class={th}>Approval</th></tr></thead>
        <tbody class="divide-y ui-border">
          {#each data.runs as r (r.retention_run_id)}
            <tr data-testid="row-{r.retention_run_id}">
              <td class="px-4 py-3"><a class="underline ui-link" href="/retention/runs/{encodeURIComponent(data.bankId)}/{encodeURIComponent(r.retention_run_id)}">{when(r.requested_at)}</a>{#if !r.requested_by_user_id}<div class="text-xs ui-muted">scheduler</div>{/if}</td>
              <td class="px-4 py-3 ui-muted">{r.retention_policy_id ? (data.policyNames[r.retention_policy_id] ?? "a removed policy") : "archive clean-up"}</td>
              <td class="px-4 py-3 ui-muted">{r.mode}</td>
              <td class="px-4 py-3 ui-muted">{r.status}</td>
              <td class="px-4 py-3 text-xs ui-muted">matched {r.matched_count} · archived {r.archived_count} · anonymised {r.anonymised_count} · deleted {r.deleted_count} · held {r.held_count} · failed {r.failed_count}{#if r.message}<div class="mt-1">{r.message}</div>{/if}</td>
              <td class="px-4 py-3 text-xs ui-muted">
                {#if r.status === "pending"}
                  {#if r.requested_by_user_id && r.requested_by_user_id === data.userId}
                    Waiting for someone else.
                  {:else}
                    <form method="POST" action="?/decide&bank_id={encodeURIComponent(data.bankId)}" class="flex flex-col gap-1">
                      <input type="hidden" name="retention_run_id" value={r.retention_run_id} />
                      <input name="comment" placeholder="Comment (optional)" aria-label="Comment" class="rounded border px-2 py-1 text-xs ui-panel ui-border" />
                      <span class="flex gap-1">
                        <button name="decision" value="approve" class="rounded px-2 py-1 preset-filled-primary-500" data-testid="approve-{r.retention_run_id}">Approve</button>
                        <button name="decision" value="reject" class="rounded px-2 py-1 preset-filled-error-500" data-testid="reject-{r.retention_run_id}">Reject</button>
                      </span>
                    </form>
                  {/if}
                {:else if r.approval_decision}
                  {r.approval_decision}{#if r.approval_comment}: {r.approval_comment}{/if}
                {:else}—{/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>
