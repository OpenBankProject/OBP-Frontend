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
  import { RESOURCE_LABELS, RESOURCE_TYPES, RETENTION_ROLES } from "$lib/services/retention";

  let { data } = $props();
  const when = (v?: string) => (v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }) : "—");
  const th = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted";
  const input = "rounded-lg border px-3 py-1.5 text-sm ui-card ui-text ui-border";
  const pageHref = (offset: number) => {
    const p = new URLSearchParams({ bank_id: data.bankId, ...Object.fromEntries(Object.entries(data.filters).filter(([, v]) => v)), offset: String(offset) });
    return `?${p}`;
  };
</script>

<svelte:head>
  <title>Retention Archive - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <RetentionHeader title="Retention Archive" intro="Copies of what retention runs archived, kept read-only until their time is up and then deleted by the scheduler. They are out of every normal endpoint and cannot be restored." bankId={data.bankId} bankIds={data.bankIds} />

  <SpaceRoleAlerts bankId={data.bankId} roles={[{ role: RETENTION_ROLES.archive, purpose: "to read the retention archive" }]} />

  <form method="GET" class="mb-4 flex flex-wrap items-end gap-2" data-testid="archive-filters">
    <input type="hidden" name="bank_id" value={data.bankId} />
    <select name="resource_type" value={data.filters.resource_type} class={input} aria-label="Resources"><option value="">All resources</option>{#each RESOURCE_TYPES as r (r)}<option value={r}>{RESOURCE_LABELS[r]}</option>{/each}</select>
    <input name="entity_name" value={data.filters.entity_name} placeholder="Dynamic Entity" aria-label="Dynamic Entity" class={input} />
    <input name="resource_id" value={data.filters.resource_id} placeholder="Resource id" aria-label="Resource id" class="{input} font-mono" />
    <input name="owner_user_id" value={data.filters.owner_user_id} placeholder="Owner user id" aria-label="Owner user id" class="{input} font-mono" />
    <button class="rounded-lg px-3 py-1.5 text-sm font-medium preset-filled-primary-500">Filter</button>
  </form>

  {#if data.loadError}<div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="load-error">{data.loadError}</div>{/if}

  <div class="overflow-x-auto rounded-lg border shadow-sm ui-card ui-border">
    {#if data.entries.length === 0}
      <div class="p-8 text-center text-sm ui-muted" data-testid="empty">Nothing archived in {data.bankId}{Object.values(data.filters).some(Boolean) ? " that matches" : ""}.</div>
    {:else}
      <table class="w-full text-sm" data-testid="archive-table">
        <thead class="ui-card"><tr><th class={th}>Archived</th><th class={th}>Resource</th><th class={th}>Owner</th><th class={th}>Deleted after</th><th class={th}>Content</th></tr></thead>
        <tbody class="divide-y ui-border">
          {#each data.entries as e (e.retention_archive_id)}
            <tr data-testid="row-{e.retention_archive_id}">
              <td class="px-4 py-3"><a class="underline ui-link" href="/retention/archive/{encodeURIComponent(data.bankId)}/{encodeURIComponent(e.retention_archive_id)}">{when(e.archived_at)}</a></td>
              <td class="px-4 py-3 font-mono text-xs">{e.resource_type}{e.entity_name ? ` ${e.entity_name}` : ""} {e.resource_id}</td>
              <td class="px-4 py-3 font-mono text-xs">{e.owner_user_id ?? "—"}</td>
              <td class="px-4 py-3 text-xs">{when(e.delete_after)}</td>
              <td class="px-4 py-3 text-xs">{e.has_content ? `${e.content_size_in_bytes ?? "?"} bytes` : "—"}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
  <div class="mt-3 flex gap-3 text-sm">
    {#if data.offset > 0}<a class="underline ui-link" href={pageHref(Math.max(0, data.offset - data.pageSize))}>Previous</a>{/if}
    {#if data.entries.length === data.pageSize}<a class="underline ui-link" href={pageHref(data.offset + data.pageSize)}>Next</a>{/if}
  </div>
</div>
