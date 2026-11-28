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
  import RetentionHeader from "$lib/components/retention/RetentionHeader.svelte";

  let { data } = $props();
  const when = (v?: string) => (v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium", hourCycle: "h23" }) : "—");
  const th = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted";
  const r = $derived(data.run);
</script>

<svelte:head>
  <title>Retention Run - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <RetentionHeader title="Retention run" intro="A run and its part of the disposal register: each resource it archived, anonymised or deleted, by id. The register keeps no content." bankId={data.bankId} bankIds={data.bankIds} />

  <dl class="mb-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 rounded-lg border p-6 text-sm shadow-sm ui-card ui-muted ui-border" data-testid="run">
    <dt>Status</dt><dd>{r.status} ({r.mode})</dd>
    <dt>Policy</dt><dd>{#if r.retention_policy_id}<a class="underline ui-link" href="/retention/{encodeURIComponent(data.bankId)}/{encodeURIComponent(r.retention_policy_id)}">{r.retention_policy_id}</a>{:else}archive clean-up{/if}</dd>
    <dt>Requested</dt><dd>{when(r.requested_at)} by {r.requested_by_user_id ?? "the scheduler"}</dd>
    {#if r.approval_decision}<dt>Approval</dt><dd>{r.approval_decision} by {r.approved_by_user_id}{#if r.approval_comment}: {r.approval_comment}{/if}</dd>{/if}
    <dt>Started, ended</dt><dd>{when(r.started_at)}, {when(r.ended_at)}</dd>
    <dt>Counts</dt><dd>matched {r.matched_count} · archived {r.archived_count} · anonymised {r.anonymised_count} · deleted {r.deleted_count} · held {r.held_count} · failed {r.failed_count}</dd>
    {#if r.message}<dt>Message</dt><dd>{r.message}</dd>{/if}
  </dl>

  <h2 class="mb-2 text-xl font-semibold ui-text">Disposal register</h2>
  <div class="overflow-x-auto rounded-lg border shadow-sm ui-card ui-border">
    {#if data.items.length === 0}
      <div class="p-8 text-center text-sm ui-muted" data-testid="empty">Nothing was disposed of in this run.</div>
    {:else}
      <table class="w-full text-sm" data-testid="items-table">
        <thead class="ui-card"><tr><th class={th}>When</th><th class={th}>Action</th><th class={th}>Resource</th><th class={th}>Owner</th><th class={th}>Part of</th><th class={th}>Archive copy</th></tr></thead>
        <tbody class="divide-y ui-border">
          {#each data.items as i (i.retention_run_item_id)}
            <tr>
              <td class="px-4 py-2 text-xs">{when(i.disposed_at)}</td>
              <td class="px-4 py-2 text-xs">{i.action}</td>
              <td class="px-4 py-2 font-mono text-xs">{i.resource_type}{i.entity_name ? ` ${i.entity_name}` : ""} {i.resource_id}</td>
              <td class="px-4 py-2 font-mono text-xs">{i.owner_user_id ?? "—"}</td>
              <td class="px-4 py-2 font-mono text-xs">{i.parent_resource_type ? `${i.parent_resource_type} ${i.parent_resource_id}` : "—"}</td>
              <td class="px-4 py-2 font-mono text-xs">{#if i.retention_archive_id}<a class="underline ui-link" href="/retention/archive/{encodeURIComponent(data.bankId)}/{encodeURIComponent(i.retention_archive_id)}">{i.retention_archive_id}</a>{:else}—{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
  <div class="mt-3 flex gap-3 text-sm">
    {#if data.offset > 0}<a class="underline ui-link" href="?offset={Math.max(0, data.offset - data.pageSize)}">Previous</a>{/if}
    {#if data.items.length === data.pageSize}<a class="underline ui-link" href="?offset={data.offset + data.pageSize}">Next</a>{/if}
  </div>
</div>
