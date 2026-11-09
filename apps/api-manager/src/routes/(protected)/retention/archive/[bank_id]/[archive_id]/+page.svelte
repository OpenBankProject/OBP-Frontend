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
  const e = $derived(data.entry);
  const when = (v?: string) => (v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium", hourCycle: "h23" }) : "—");
</script>

<svelte:head>
  <title>Archived {data.entry.resource_type} - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <RetentionHeader title="Archived {data.entry.resource_type.replaceAll('_', ' ')}" intro="A read-only copy, as the resource was when archived. It cannot be restored, and is deleted when its time is up." bankId={data.bankId} bankIds={data.bankIds} />

  <dl class="mb-6 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1 rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-700 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" data-testid="archive-entry">
    <dt>Resource</dt><dd class="font-mono text-xs">{e.resource_type}{e.entity_name ? ` ${e.entity_name}` : ""} {e.resource_id}</dd>
    <dt>Owner</dt><dd class="font-mono text-xs">{e.owner_user_id ?? "—"}</dd>
    {#if e.parent_resource_type}<dt>Part of</dt><dd class="font-mono text-xs">{e.parent_resource_type} {e.parent_resource_id}</dd>{/if}
    <dt>Archived</dt><dd>{when(e.archived_at)} by run <a class="text-blue-600 underline dark:text-blue-400" href="/retention/runs/{encodeURIComponent(data.bankId)}/{encodeURIComponent(e.retention_run_id)}">{e.retention_run_id}</a></dd>
    <dt>Deleted after</dt><dd>{when(e.delete_after)}</dd>
    {#if e.has_content}<dt>Content</dt><dd><a class="text-blue-600 underline dark:text-blue-400" href="/retention/archive/{encodeURIComponent(data.bankId)}/{encodeURIComponent(e.retention_archive_id)}/content" data-testid="download">Download ({e.content_size_in_bytes ?? "?"} bytes)</a></dd>{/if}
  </dl>

  <h2 class="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">As archived</h2>
  <pre class="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200" data-testid="archive-data">{JSON.stringify(e.data ?? {}, null, 2)}</pre>
</div>
