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
  import { safeLinkHref } from "@obp/shared/utils";
  import { page } from "$app/state";
  import { goto, invalidateAll } from "$app/navigation";
  import { CircleHelp, Plus, Trash2, Pencil } from "@lucide/svelte";
  import { DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID } from "@obp/shared/obp";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";
  import { deleteDomainApi } from "$lib/services/domainApis";

  let { data } = $props();

  let message = $state<string | null>(page.url.searchParams.get("saved") ? `Saved /${page.url.searchParams.get("saved")}.` : null);
  let actionError = $state<string | null>(null);
  let deleting = $state<string | null>(null);

  // SYS first, then the banks; a bank_id from the URL that is not listed is kept so the picker shows it.
  const spaces = $derived([...new Set([DYNAMIC_ENTITY_SYSTEM_SPACE_BANK_ID, ...data.bankIds, data.bankId])]);

  function chooseSpace(event: Event) {
    const bankId = (event.currentTarget as HTMLSelectElement).value;
    goto(`/domain-apis?bank_id=${encodeURIComponent(bankId)}`);
  }

  async function remove(domainApiId: string, basePath: string) {
    if (!confirm(`Delete the Domain API /${basePath}?`)) return;
    deleting = domainApiId;
    actionError = null;
    try {
      await deleteDomainApi(data.bankId, domainApiId);
      message = `Deleted /${basePath}.`;
      await invalidateAll();
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      deleting = null;
    }
  }
</script>

<svelte:head>
  <title>Domain APIs - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
    <h1 class="text-3xl font-bold ui-text">Domain APIs</h1>
    <div class="flex items-center gap-2">
      <label for="space" class="text-sm ui-muted">Space</label>
      <select id="space" name="bank_id" value={data.bankId} onchange={chooseSpace} class="rounded-lg border px-3 py-2 font-mono text-sm ui-card ui-text ui-border" data-testid="space-select">
        {#each spaces as s (s)}
          <option value={s}>{s}</option>
        {/each}
      </select>
      <a href="/domain-apis/help" aria-label="Domain APIs help" data-testid="domain-apis-help-link" class="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border">
        <CircleHelp size={16} />
      </a>
      <a href="/domain-apis/create?bank_id={encodeURIComponent(data.bankId)}" data-testid="create-link" class="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium preset-filled-primary-500">
        <Plus size={16} /> Create Domain API
      </a>
    </div>
  </div>

  <div class="mb-4"><ApiExplorerEndpoints endpoints={data.endpoints} /></div>

  {#if data.loadError}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="load-error">{data.loadError}</div>
  {/if}
  {#if actionError}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="action-error">{actionError}</div>
  {/if}
  {#if message}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-success" role="status" data-testid="message">{message}</div>
  {/if}

  <div class="overflow-hidden rounded-lg border shadow-sm ui-card ui-border">
    {#if data.domainApis.length === 0}
      <div class="p-8 text-center text-sm ui-muted" data-testid="empty">
        No Domain APIs in {data.bankId}.
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="domain-apis-table">
          <thead class="ui-card">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Title</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">URL</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Version</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">OpenAPI</th>
              <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y ui-border">
            {#each data.domainApis as d (d.domain_api_id)}
              <tr data-testid="row-{d.domain_api_id}">
                <td class="px-4 py-3 ui-text">
                  <a href="/domain-apis/{encodeURIComponent(d.bank_id)}/{encodeURIComponent(d.domain_api_id)}" class="hover:underline ui-link">{d.title}</a>
                  {#if d.description}<div class="text-xs ui-muted">{d.description}</div>{/if}
                </td>
                <td class="px-4 py-3 font-mono text-xs"><a href={safeLinkHref(d.url)} target="_blank" rel="noopener noreferrer" class="hover:underline ui-link">{d.url}</a></td>
                <td class="px-4 py-3 font-mono text-xs ui-muted">{d.version}</td>
                <td class="px-4 py-3 font-mono text-xs">
                  <a href={safeLinkHref(d.openapi_url)} target="_blank" rel="noopener noreferrer" class="hover:underline ui-link">yaml</a>
                  <a href={safeLinkHref(d.openapi_url?.replace(/\.yaml$/, ".json"))} target="_blank" rel="noopener noreferrer" class="ml-2 hover:underline ui-link">json</a>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <a href="/domain-apis/{encodeURIComponent(d.bank_id)}/{encodeURIComponent(d.domain_api_id)}" class="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ui-hover ui-muted ui-border" data-testid="edit-{d.domain_api_id}"><Pencil size={12} /> Edit</a>
                    <button type="button" onclick={() => remove(d.domain_api_id, d.base_path)} disabled={deleting === d.domain_api_id} class="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs disabled:opacity-50 ui-tone-error" data-testid="delete-{d.domain_api_id}">
                      <Trash2 size={12} /> {deleting === d.domain_api_id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="border-t px-4 py-2 text-xs ui-muted ui-border">{data.domainApis.length} Domain API{data.domainApis.length === 1 ? "" : "s"} in {data.bankId}</div>
    {/if}
  </div>
</div>
