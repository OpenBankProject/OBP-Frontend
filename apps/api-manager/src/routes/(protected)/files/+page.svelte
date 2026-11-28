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
  import { Plus } from "@lucide/svelte";
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
    return new Date(dateString).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" });
  }
</script>

<svelte:head>
  <title>Files - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
    <h1 class="text-3xl font-bold ui-text">Files</h1>
    <a href="/files/create" data-testid="create-link" class="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium preset-filled-primary-500">
      <Plus size={16} /> Create File
    </a>
  </div>

  {#if !bankId}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-card ui-muted ui-border" data-testid="no-bank">
      Select a bank using the bank selector to see its files.
    </div>
  {:else}
    <SpaceRoleAlerts {bankId} roles={[{ role: "CanGetFileAtOneBank", purpose: "to see the files of this bank" }]} />
  {/if}

  {#if loading}
    <div class="p-4 text-sm ui-muted" data-testid="loading">Loading files…</div>
  {/if}

  {#if loadError}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="load-error">{loadError}</div>
  {/if}

  {#if filesPage}
    <div class="overflow-hidden rounded-lg border shadow-sm ui-card ui-border">
      {#if files.length === 0}
        <div class="p-8 text-center text-sm ui-muted" data-testid="empty">
          No files in {bankId}.
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm" data-testid="files-table">
            <thead class="ui-card">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">File</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Media type</th>
                <th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider ui-muted">Size (bytes)</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Public</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Owner</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Stored</th>
                <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Content</th>
              </tr>
            </thead>
            <tbody class="divide-y ui-border">
              {#each files as f (f.file_id)}
                <tr data-testid="row-{f.file_id}">
                  <td class="px-4 py-3 ui-text">
                    <a href={contentHref(f.file_id, true)} target="_blank" rel="noopener noreferrer" class="hover:underline ui-link" data-testid="name-{f.file_id}">{f.file_name}</a>
                    <div class="font-mono text-xs ui-muted">{f.file_id}</div>
                  </td>
                  <td class="px-4 py-3 font-mono text-xs ui-muted">{f.media_type}</td>
                  <td class="px-4 py-3 text-right font-mono text-xs ui-muted">{f.size_in_bytes}</td>
                  <td class="px-4 py-3 text-xs" data-testid="public-{f.file_id}" data-state={f.is_public ? "public" : "private"}>
                    {#if f.is_public}
                      <span class="rounded px-2 py-0.5 ui-tone-success">Public</span>
                    {:else}
                      <span class="ui-muted">Private</span>
                    {/if}
                  </td>
                  <td class="px-4 py-3 font-mono text-xs ui-muted">
                    <a href="/users/{encodeURIComponent(f.owner_user_id)}" class="hover:underline ui-link">{f.owner_user_id}</a>
                  </td>
                  <td class="px-4 py-3 text-xs ui-muted">{formatDate(f.created_at)}</td>
                  <td class="px-4 py-3 text-xs">
                    <a href={contentHref(f.file_id, true)} target="_blank" rel="noopener noreferrer" class="hover:underline ui-link" data-testid="open-{f.file_id}">Open</a>
                    <a href={contentHref(f.file_id, false)} class="ml-2 hover:underline ui-link" data-testid="download-{f.file_id}">Download</a>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between border-t px-4 py-2 text-xs ui-muted ui-border">
          <span data-testid="files-count">{offset + 1}–{offset + files.length} of {total} file{total === 1 ? "" : "s"} in {bankId}</span>
          <span class="flex gap-3">
            {#if offset > 0}
              <button type="button" onclick={() => (offset = Math.max(0, offset - data.pageSize))} class="hover:underline ui-link" data-testid="previous-page">Previous</button>
            {/if}
            {#if offset + files.length < total}
              <button type="button" onclick={() => (offset = offset + data.pageSize)} class="hover:underline ui-link" data-testid="next-page">Next</button>
            {/if}
          </span>
        </div>
      {/if}
    </div>
  {/if}
</div>
