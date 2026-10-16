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
  import { page } from "$app/state";
  import { goto, invalidateAll } from "$app/navigation";
  import { Plus, Trash2, Pencil, CircleHelp } from "@lucide/svelte";
  import { DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID } from "@obp/shared/obp";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";
  import SpaceRoleAlerts from "$lib/components/SpaceRoleAlerts.svelte";
  import { deleteWebhook, describeCondition, webhookPageHref, DEACTIVATED_REASONS, WEBHOOK_ROLES, type DynamicEntityWebhook } from "$lib/services/dynamicEntityWebhooks";

  let { data } = $props();

  let message = $state<string | null>(page.url.searchParams.get("saved") ? `Saved the webhook to ${page.url.searchParams.get("saved")}.` : null);
  let actionError = $state<string | null>(null);
  let deleting = $state<string | null>(null);

  // SYS first, then the banks; a bank_id from the URL that is not listed is kept so the picker shows it.
  const spaces = $derived([...new Set([DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID, ...data.bankIds, data.bankId])]);
  const createHref = $derived(
    `/dynamic-entity-webhooks/create?bank_id=${encodeURIComponent(data.bankId)}` +
      (data.dynamicEntityId ? `&dynamic_entity_id=${encodeURIComponent(data.dynamicEntityId)}` : ""),
  );

  function chooseSpace(event: Event) {
    const bankId = (event.currentTarget as HTMLSelectElement).value;
    goto(`/dynamic-entity-webhooks?bank_id=${encodeURIComponent(bankId)}`);
  }

  async function remove(w: DynamicEntityWebhook) {
    if (!confirm(`Delete the webhook of ${w.entity_name} to ${w.url}? Requests not yet delivered are dropped.`)) return;
    deleting = w.webhook_id;
    actionError = null;
    try {
      await deleteWebhook(w.bank_id, w.dynamic_entity_id, w.webhook_id);
      message = `Deleted the webhook to ${w.url}.`;
      await invalidateAll();
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      deleting = null;
    }
  }
</script>

<svelte:head>
  <title>Dynamic Entity Webhooks - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Dynamic Entity Webhooks</h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        OBP sends a POST request to a webhook's URL when records of its Dynamic Entity are created, updated or deleted.
        The request names the record but carries none of its values.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <label for="space" class="text-sm text-gray-700 dark:text-gray-300">Space</label>
      <select id="space" name="bank_id" value={data.bankId} onchange={chooseSpace} class="rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" data-testid="space-select">
        {#each spaces as s (s)}
          <option value={s}>{s}</option>
        {/each}
      </select>
<a href="/dynamic-entity-webhooks/help" aria-label="Dynamic Entity Webhooks help" data-testid="webhooks-help-link" class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
        <CircleHelp size={16} />
      </a>
      <a href={createHref} data-testid="create-link" class="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
        <Plus size={16} /> Create webhook
      </a>
    </div>
  </div>

  <div class="mb-4"><ApiExplorerEndpoints endpoints={data.endpoints} /></div>

  <SpaceRoleAlerts bankId={data.bankId} roles={[
    { role: WEBHOOK_ROLES.get, purpose: "to list its webhooks" },
    { role: WEBHOOK_ROLES.create, purpose: "to create a webhook" },
    { role: WEBHOOK_ROLES.delete, purpose: "to delete a webhook" },
  ]} />

  {#if data.dynamicEntityId}
    <div class="mb-4 text-sm text-gray-700 dark:text-gray-300" data-testid="entity-filter">
      Showing the webhooks of one entity. <a href="/dynamic-entity-webhooks?bank_id={encodeURIComponent(data.bankId)}" class="text-blue-600 hover:underline dark:text-blue-400">Show every webhook in {data.bankId}</a>
    </div>
  {/if}
  {#if data.loadError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="load-error">{data.loadError}</div>
  {/if}
  {#if actionError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="action-error">{actionError}</div>
  {/if}
  {#if message}
    <div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300" role="status" data-testid="message">{message}</div>
  {/if}

  <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
    {#if data.webhooks.length === 0}
      <div class="p-8 text-center text-sm text-gray-500 dark:text-gray-400" data-testid="empty">
        No Dynamic Entity webhooks in {data.bankId}.
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="webhooks-table">
          <thead class="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Entity</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">URL</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Events</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            {#each data.webhooks as w (w.webhook_id)}
              <tr data-testid="row-{w.webhook_id}">
                <td class="px-4 py-3 font-mono text-xs text-gray-900 dark:text-gray-100">{w.entity_name}</td>
                <td class="px-4 py-3 font-mono text-xs">
                  <a href={webhookPageHref(w)} class="text-blue-600 hover:underline dark:text-blue-400">{w.url}</a>
                  {#if w.description}<div class="font-sans text-xs text-gray-500 dark:text-gray-400">{w.description}</div>{/if}
                </td>
                <td class="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                  {w.events.join(", ")}
                  {#if w.field_conditions.length > 0}
                    <div class="text-gray-500 dark:text-gray-400">Updates when: {w.field_conditions.map(describeCondition).join("; ")}</div>
                  {/if}
                </td>
                <td class="px-4 py-3 text-xs">
                  {#if w.is_active}
                    <span class="rounded-full bg-green-100 px-2 py-0.5 text-green-800 dark:bg-green-900/30 dark:text-green-300">Active</span>
                  {:else}
                    <span class="rounded-full bg-gray-200 px-2 py-0.5 text-gray-800 dark:bg-gray-700 dark:text-gray-200" title={DEACTIVATED_REASONS[w.deactivated_reason ?? ""] ?? ""}>Off: {w.deactivated_reason ?? "TURNED_OFF"}</span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <a href={webhookPageHref(w)} class="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700" data-testid="edit-{w.webhook_id}"><Pencil size={12} /> Open</a>
                    <button type="button" onclick={() => remove(w)} disabled={deleting === w.webhook_id} class="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20" data-testid="delete-{w.webhook_id}">
                      <Trash2 size={12} /> {deleting === w.webhook_id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">{data.webhooks.length} webhook{data.webhooks.length === 1 ? "" : "s"} in {data.bankId}</div>
    {/if}
  </div>
</div>
