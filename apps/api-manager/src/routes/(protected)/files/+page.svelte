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
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";
  import SpaceRoleAlerts from "$lib/components/SpaceRoleAlerts.svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  interface ObpFile {
    file_id: string;
    file_name: string;
    media_type: string;
    size_in_bytes: number;
    is_public: boolean;
    owner_user_id: string;
    created_at: string;
  }
  interface ObpFilesPage {
    files: ObpFile[];
    pagination: { total: number; limit: number; offset: number };
  }

  let { data } = $props();

  let offset = $state(0);
  let filesPage = $state<ObpFilesPage | null>(null);
  let loading = $state(false);
  let loadError = $state<string | null>(null);

  const bankId = $derived(currentBank.bankId);
  const files = $derived(filesPage?.files ?? []);
  const total = $derived(filesPage?.pagination.total ?? 0);

  // Load the page of files shown; a different bank starts again at its first page.
  let shownBank = "";
  $effect(() => {
    const bank = bankId;
    const from = offset;
    if (bank !== shownBank) {
      shownBank = bank;
      if (from !== 0) {
        offset = 0; // runs this effect again, for the first page
        return;
      }
    }
    loadFiles(bank, from);
  });

  async function loadFiles(bank: string, from: number) {
    filesPage = null;
    loadError = null;
    if (!bank) return;
    loading = true;
    try {
      const res = await trackedFetch(`/proxy/obp/v7.0.0/management/banks/${encodeURIComponent(bank)}/files?limit=${data.pageSize}&offset=${from}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      if (bank === bankId && from === offset) filesPage = body as ObpFilesPage;
    } catch (e) {
      if (bank === bankId && from === offset) loadError = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  function contentHref(fileId: string, inline: boolean): string {
    return `/backend/files/${encodeURIComponent(bankId)}/${encodeURIComponent(fileId)}/content${inline ? "?inline=true" : ""}`;
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }
</script>

<svelte:head>
  <title>Files - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6">
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Files</h1>
  </div>

  <div class="mb-4"><ApiExplorerEndpoints endpoints={data.endpoints} /></div>

  {#if !bankId}
    <div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" data-testid="no-bank">
      Select a bank using the bank selector to see its files.
    </div>
  {:else}
    <SpaceRoleAlerts {bankId} roles={[{ role: "CanGetFileAtOneBank", purpose: "to see the files of this bank" }]} />
  {/if}

  {#if loading}
    <div class="p-4 text-sm text-gray-500 dark:text-gray-400" data-testid="loading">Loading files…</div>
  {/if}

  {#if loadError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="load-error">{loadError}</div>
  {/if}

  {#if filesPage}
    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {#if files.length === 0}
        <div class="p-8 text-center text-sm text-gray-500 dark:text-gray-400" data-testid="empty">
          No files in {bankId}.
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm" data-testid="files-table">
            <thead class="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">File</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Media type</th>
                <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Size (bytes)</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Public</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Owner</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Stored</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Content</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              {#each files as f (f.file_id)}
                <tr data-testid="row-{f.file_id}">
                  <td class="px-4 py-3 text-gray-900 dark:text-gray-100">
                    <a href={contentHref(f.file_id, true)} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline dark:text-blue-400" data-testid="name-{f.file_id}">{f.file_name}</a>
                    <div class="font-mono text-xs text-gray-500 dark:text-gray-400">{f.file_id}</div>
                  </td>
                  <td class="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{f.media_type}</td>
                  <td class="px-4 py-3 text-right font-mono text-xs text-gray-700 dark:text-gray-300">{f.size_in_bytes}</td>
                  <td class="px-4 py-3 text-xs" data-testid="public-{f.file_id}" data-state={f.is_public ? "public" : "private"}>
                    {#if f.is_public}
                      <span class="rounded bg-green-100 px-2 py-0.5 text-green-800 dark:bg-green-900/30 dark:text-green-300">Public</span>
                    {:else}
                      <span class="text-gray-500 dark:text-gray-400">Private</span>
                    {/if}
                  </td>
                  <td class="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                    <a href="/users/{encodeURIComponent(f.owner_user_id)}" class="text-blue-600 hover:underline dark:text-blue-400">{f.owner_user_id}</a>
                  </td>
                  <td class="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">{formatDate(f.created_at)}</td>
                  <td class="px-4 py-3 text-xs">
                    <a href={contentHref(f.file_id, true)} target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline dark:text-blue-400" data-testid="open-{f.file_id}">Open</a>
                    <a href={contentHref(f.file_id, false)} class="ml-2 text-blue-600 hover:underline dark:text-blue-400" data-testid="download-{f.file_id}">Download</a>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between border-t border-gray-200 px-4 py-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          <span data-testid="files-count">{offset + 1}–{offset + files.length} of {total} file{total === 1 ? "" : "s"} in {bankId}</span>
          <span class="flex gap-3">
            {#if offset > 0}
              <button type="button" onclick={() => (offset = Math.max(0, offset - data.pageSize))} class="text-blue-600 hover:underline dark:text-blue-400" data-testid="previous-page">Previous</button>
            {/if}
            {#if offset + files.length < total}
              <button type="button" onclick={() => (offset = offset + data.pageSize)} class="text-blue-600 hover:underline dark:text-blue-400" data-testid="next-page">Next</button>
            {/if}
          </span>
        </div>
      {/if}
    </div>
  {/if}
</div>
