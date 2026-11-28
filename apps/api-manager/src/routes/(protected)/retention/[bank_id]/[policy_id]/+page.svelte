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
  import SpaceRoleAlerts from "$lib/components/SpaceRoleAlerts.svelte";
  import RetentionHeader from "$lib/components/retention/RetentionHeader.svelte";
  import RetentionPolicyForm from "$lib/components/retention/RetentionPolicyForm.svelte";
  import { describePolicy, RETENTION_ROLES } from "$lib/services/retention";

  let { data, form } = $props();
  const box = "rounded-lg border p-6 shadow-sm ui-card ui-border";
  const when = (v?: string) => (v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }) : "—");
</script>

<svelte:head>
  <title>Retention Policy - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <RetentionHeader title={data.policy.name || "Retention policy"} intro={describePolicy(data.policy)} bankId={data.bankId} bankIds={data.bankIds} />

  <SpaceRoleAlerts bankId={data.bankId} roles={[
    { role: RETENTION_ROLES.run, purpose: "to run this policy" },
    { role: RETENTION_ROLES.manage, purpose: "to change or remove it" },
    { role: RETENTION_ROLES.getRuns, purpose: "to see its runs" },
  ]} />

  {#if form?.error}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="action-error">{form.error}</div>
  {/if}
  {#if form?.message}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-success" role="status" data-testid="message">
      {form.message}{#if form.runId} <a class="underline" href="/retention/runs/{encodeURIComponent(data.bankId)}/{encodeURIComponent(form.runId)}">See the run</a>{/if}
    </div>
  {/if}

  <section class="{box} mb-6" data-testid="preview">
    <h2 class="mb-2 text-xl font-semibold ui-text">What it would do now</h2>
    {#if data.previewError}
      <p class="text-sm ui-text-error">{data.previewError}</p>
    {:else if data.preview}
      {@const p = data.preview}
      <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 text-sm ui-muted">
        <dt>Due now</dt><dd><strong>{p.due_count}</strong>{p.count_is_capped ? ` (more than one run handles; ${p.max_items_per_run} per run)` : ""}</dd>
        <dt>Past the cut-off</dt><dd>{p.matched_count}, of which {p.held_count} under a legal hold</dd>
        <dt>Cut-off</dt><dd>{when(p.cutoff_date)}</dd>
        {#if p.minimum_retain_days !== undefined}<dt>Minimum retention</dt><dd>{p.minimum_retain_days} days, set in OBP-API; a shorter policy runs as though it were this long</dd>{/if}
        <dt>Oldest</dt><dd>{when(p.oldest_trigger_date)}</dd>
        <dt>Archive copies to delete</dt><dd>{p.archive_entries_due_count}</dd>
        <dt>Switched on in OBP-API</dt><dd>archiving {p.archive_enabled ? "on" : "off"}, deleting {p.delete_enabled ? "on" : "off"}</dd>
        {#if p.sample_resource_ids.length}<dt>For example</dt><dd class="font-mono text-xs">{p.sample_resource_ids.join(", ")}</dd>{/if}
      </dl>
      {#if !p.can_execute}
        <p class="mt-3 text-sm ui-text-warning">This action is switched off in OBP-API's props, so a run is refused (and recorded). A preview run still works.</p>
      {/if}
    {/if}
    <div class="mt-4 flex flex-wrap gap-2">
      <form method="POST" action="?/run"><input type="hidden" name="mode" value="execute" /><button class="rounded-lg px-4 py-2 text-sm font-medium preset-filled-primary-500" data-testid="run-execute">{data.policy.requires_approval ? "Ask to run (needs approval)" : "Run now"}</button></form>
      <form method="POST" action="?/run"><input type="hidden" name="mode" value="preview" /><button class="rounded-lg border px-4 py-2 text-sm font-medium ui-card ui-muted ui-border" data-testid="run-preview">Record a preview run</button></form>
    </div>
  </section>

  <section class="{box} mb-6" data-testid="policy-runs">
    <h2 class="mb-2 text-xl font-semibold ui-text">Its runs</h2>
    {#if data.runs === null}
      <p class="text-sm ui-muted">Runs are shown with {RETENTION_ROLES.getRuns}.</p>
    {:else if data.runs.length === 0}
      <p class="text-sm ui-muted">No runs yet.</p>
    {:else}
      <ul class="flex flex-col gap-1 text-sm ui-muted">
        {#each data.runs as r (r.retention_run_id)}
          <li><a class="underline ui-link" href="/retention/runs/{encodeURIComponent(data.bankId)}/{encodeURIComponent(r.retention_run_id)}">{when(r.requested_at)}</a> · {r.mode} · {r.status} · archived {r.archived_count}, deleted {r.deleted_count}, anonymised {r.anonymised_count}, held {r.held_count}, failed {r.failed_count}</li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="{box} mb-6" data-testid="update-policy">
    <h2 class="mb-4 text-xl font-semibold ui-text">Change the policy</h2>
    <form method="POST" action="?/update">
      <RetentionPolicyForm entityNames={data.entityNames} policy={data.policy} submitLabel="Save" />
    </form>
  </section>

  <section class={box} data-testid="remove-policy">
    <h2 class="mb-2 text-xl font-semibold ui-text">Remove the policy</h2>
    <p class="mb-3 text-sm ui-muted">Its runs waiting for approval are refused. What it already archived stays in the archive until its time is up.</p>
    <form method="POST" action="?/remove"><button class="rounded-lg px-4 py-2 text-sm font-medium preset-filled-error-500" data-testid="remove">Remove</button></form>
  </section>
</div>
