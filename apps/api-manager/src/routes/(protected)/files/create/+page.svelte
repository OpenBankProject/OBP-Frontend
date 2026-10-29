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
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  const bankId = $derived(currentBank.bankId);

  let file = $state<File | null>(null);
  let isPublic = $state(false);
  let saving = $state(false);
  let saveError = $state<string | null>(null);

  function chooseFile(event: Event) {
    file = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
    saveError = null;
  }

  /** The file's bytes as base64, which is how Create File takes them. */
  async function base64Of(f: File): Promise<string> {
    const bytes = new Uint8Array(await f.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  }

  async function createFile(event: SubmitEvent) {
    event.preventDefault();
    if (!file || !bankId) return;
    saving = true;
    saveError = null;
    try {
      const res = await trackedFetch(`/proxy/obp/v7.0.0/banks/${encodeURIComponent(bankId)}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: file.name,
          media_type: file.type || "application/octet-stream",
          content_base64: await base64Of(file),
          is_public: isPublic,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? `HTTP ${res.status}`);
      await goto("/files");
    } catch (e) {
      saveError = e instanceof Error ? e.message : String(e);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Create File - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-3xl px-4 py-8">
  <div class="mb-6">
    <a href="/files" class="text-sm text-blue-600 hover:underline dark:text-blue-400">← Files</a>
    <h1 class="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">Create File</h1>
  </div>

  {#if !bankId}
    <div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" data-testid="no-bank">
      Select a bank using the bank selector to store a file in it.
    </div>
  {:else}
    <SpaceRoleAlerts
      {bankId}
      roles={[
        { role: "CanCreateFileAtOneBank", purpose: "to store a file in this bank" },
        ...(isPublic ? [{ role: "CanCreatePublicFileAtOneBank", purpose: "to store a public file" }] : []),
      ]}
    />

    <form onsubmit={createFile} class="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="create-file-form">
      <div>
        <label for="file" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">File</label>
        <input
          id="file"
          type="file"
          required
          onchange={chooseFile}
          class="block w-full cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-4 text-sm text-gray-700 hover:border-blue-400 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-500 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 dark:file:bg-blue-500 dark:hover:file:bg-blue-600"
          data-testid="file-input"
        />
      </div>

      <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" bind:checked={isPublic} data-testid="is-public" />
        Public: anyone may read it without logging in
      </label>

      <p class="text-sm text-gray-600 dark:text-gray-400">Stored in <span class="font-mono">{bankId}</span>.</p>

      {#if saveError}
        <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="save-error">{saveError}</div>
      {/if}

      <button type="submit" disabled={saving} class="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600" data-testid="create-button">
        {saving ? "Storing…" : "Create File"}
      </button>
    </form>
  {/if}
</div>
