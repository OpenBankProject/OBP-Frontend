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

  let { data, form } = $props();
  const when = (v?: string) => (v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }) : "—");
  const th = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400";
  const input = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100";
  const label = "block text-sm font-medium text-gray-700 dark:text-gray-300";
  let type = $state("dynamic_entity_record");
</script>

<svelte:head>
  <title>Legal Holds - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <RetentionHeader title="Legal Holds" intro="A hold keeps a resource, or every record of a Dynamic Entity, out of every retention run until it is released: for a dispute, an audit or an investigation. A released hold stays listed, with who released it." bankId={data.bankId} bankIds={data.bankIds} />

  <SpaceRoleAlerts bankId={data.bankId} roles={[{ role: RETENTION_ROLES.holds, purpose: "to place and release legal holds" }]} />

  {#if data.loadError}<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="load-error">{data.loadError}</div>{/if}
  {#if form?.error}<div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="action-error">{form.error}</div>{/if}
  {#if form?.message}<div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300" role="status" data-testid="message">{form.message}</div>{/if}

  <p class="mb-2 text-sm"><a class="text-blue-600 underline dark:text-blue-400" href="?bank_id={encodeURIComponent(data.bankId)}{data.showAll ? '' : '&all=true'}">{data.showAll ? "Show active holds only" : "Show released holds too"}</a></p>
  <div class="mb-8 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    {#if data.holds.length === 0}
      <div class="p-8 text-center text-sm text-gray-500 dark:text-gray-400" data-testid="empty">No holds in {data.bankId}.</div>
    {:else}
      <table class="w-full text-sm" data-testid="holds-table">
        <thead class="bg-gray-50 dark:bg-gray-900"><tr><th class={th}>Held</th><th class={th}>Reason</th><th class={th}>Placed</th><th class={th}>Released</th><th class={th}></th></tr></thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          {#each data.holds as h (h.retention_hold_id)}
            <tr data-testid="row-{h.retention_hold_id}">
              <td class="px-4 py-3 font-mono text-xs">{h.resource_type}{h.entity_name ? ` ${h.entity_name}` : ""} {h.resource_id ?? "(all records)"}</td>
              <td class="px-4 py-3 text-gray-700 dark:text-gray-300">{h.reason}</td>
              <td class="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">{when(h.placed_at)}<div class="font-mono">{h.placed_by_user_id}</div></td>
              <td class="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">{#if h.released_at}{when(h.released_at)}<div class="font-mono">{h.released_by_user_id}</div>{:else}—{/if}</td>
              <td class="px-4 py-3">{#if h.is_active}<form method="POST" action="?/release&bank_id={encodeURIComponent(data.bankId)}"><input type="hidden" name="retention_hold_id" value={h.retention_hold_id} /><button class="rounded bg-red-600 px-2 py-1 text-xs text-white dark:bg-red-500" data-testid="release-{h.retention_hold_id}">Release</button></form>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <section class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="place-hold">
    <h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Place a hold in {data.bankId}</h2>
    <form method="POST" action="?/place&bank_id={encodeURIComponent(data.bankId)}" class="grid gap-4 md:grid-cols-2">
      <div><label class={label} for="resource_type">Resources</label>
        <select id="resource_type" name="resource_type" class={input} bind:value={type}>{#each RESOURCE_TYPES as r (r)}<option value={r}>{RESOURCE_LABELS[r]}</option>{/each}</select></div>
      {#if type === "dynamic_entity_record"}
        <div><label class={label} for="entity_name">Dynamic Entity (alone: holds all its records)</label>
          <select id="entity_name" name="entity_name" class={input}><option value="">—</option>{#each data.entityNames as n (n)}<option value={n}>{n}</option>{/each}</select></div>
      {/if}
      <div><label class={label} for="resource_id">Resource id</label><input id="resource_id" name="resource_id" class="{input} font-mono" /></div>
      <div class="md:col-span-2"><label class={label} for="reason">Reason</label><input id="reason" name="reason" required maxlength="1000" class={input} /></div>
      <button class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white dark:bg-blue-500 md:col-span-2 md:justify-self-start" data-testid="place">Place the hold</button>
    </form>
  </section>
</div>
