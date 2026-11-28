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
  import type { PageData } from "./$types";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";

  let { data }: { data: PageData } = $props();

  let searchQuery = $state("");
  let deleteError = $state<string | null>(null);
  let successMessage = $state<string | null>(null);

  interface ResourceDoc {
    dynamic_resource_doc_id: string;
    partial_function_name: string;
    request_verb: string;
    request_url: string;
    summary: string;
    tags: string;
    roles: string;
  }

  const filteredDocs = $derived(
    (data.docs || []).filter((doc: ResourceDoc) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        doc.partial_function_name?.toLowerCase().includes(q) ||
        doc.request_url?.toLowerCase().includes(q) ||
        doc.request_verb?.toLowerCase().includes(q) ||
        doc.summary?.toLowerCase().includes(q) ||
        doc.tags?.toLowerCase().includes(q) ||
        doc.roles?.toLowerCase().includes(q)
      );
    }),
  );

  function methodBadgeClass(verb: string): string {
    switch (verb?.toUpperCase()) {
      case "GET": return "ui-tone-success";
      case "POST": return "ui-tone-info";
      case "PUT": return "ui-tone-warning";
      case "DELETE": return "ui-tone-error";
      default: return "ui-panel ui-text";
    }
  }

  async function deleteDoc(id: string) {
    deleteError = null;
    successMessage = null;
    try {
      const response = await fetch(
        `/proxy/obp/v5.1.0/management/dynamic-resource-docs/${encodeURIComponent(id)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to delete dynamic resource doc",
        );
        logErrorDetails("Delete Dynamic Resource Doc", errorDetails);
        deleteError = formatErrorForDisplay(errorDetails);
        return;
      }
      successMessage = "Dynamic resource doc deleted.";
      // Optimistically remove the deleted row locally so we avoid a full reload.
      data = { ...data, docs: (data.docs || []).filter((d: ResourceDoc) => d.dynamic_resource_doc_id !== id) };
    } catch (e) {
      deleteError = e instanceof Error ? e.message : "Failed to delete";
    }
  }
</script>

<svelte:head>
  <title>System Dynamic Resource Docs - API Manager</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold ui-text">
        System Dynamic Resource Docs
      </h1>
      <p class="mt-1 ui-muted">
        Endpoints implemented by Scala method bodies compiled at runtime. Served under
        <code class="rounded px-1 ui-panel">/obp/dynamic-resource-doc/...</code>
      </p>
    </div>
    <div class="flex items-center gap-2">
      <a
        href="/dynamic-resource-docs/help"
        data-testid="dynamic-resource-docs-help-link"
        class="inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border"
      >
        Help
      </a>
      <a
        href="/dynamic-resource-docs/system/create"
        data-testid="create-link"
        class="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium preset-filled-primary-500"
      >
        Create Resource Doc
      </a>
    </div>
  </div>

  {#if data.error}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error">
      {data.error}
    </div>
  {/if}
  {#if deleteError}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-error" data-testid="delete-error">
      {deleteError}
    </div>
  {/if}
  {#if successMessage}
    <div class="mb-6 rounded-lg border p-4 text-sm ui-tone-success" data-testid="success-message">
      {successMessage}
    </div>
  {/if}

  <div class="mb-4">
    <input
      type="search"
      name="search"
      bind:value={searchQuery}
      placeholder="Filter by name, URL, verb, tag, role..."
      data-testid="search-input"
      class="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 ui-card ui-text ui-border"
    />
  </div>

  {#if filteredDocs.length === 0}
    <div class="rounded-lg border p-8 text-center text-sm ui-card ui-muted ui-border">
      {#if (data.docs || []).length === 0}
        No dynamic resource docs yet. <a href="/dynamic-resource-docs/system/create" class="hover:underline ui-link">Create one</a> to get started.
      {:else}
        No docs match "{searchQuery}".
      {/if}
    </div>
  {:else}
    <div class="overflow-x-auto rounded-lg border shadow-sm ui-card ui-border">
      <table class="min-w-full divide-y ui-border">
        <thead class="ui-card">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Method</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">URL</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Function Name</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Summary</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Roles</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y ui-card ui-border">
          {#each filteredDocs as doc (doc.dynamic_resource_doc_id)}
            <tr data-testid="doc-row" data-doc-id={doc.dynamic_resource_doc_id}>
              <td class="whitespace-nowrap px-4 py-3 align-top">
                <span class="inline-flex w-16 items-center justify-center rounded px-2 py-0.5 text-xs font-medium {methodBadgeClass(doc.request_verb)}">
                  {doc.request_verb}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-top font-mono text-sm ui-text">
                {doc.request_url || "—"}
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-top text-sm ui-text">
                {doc.partial_function_name || "—"}
              </td>
              <td class="px-4 py-3 align-top text-sm ui-muted">
                {doc.summary || "—"}
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-top text-xs ui-muted">
                {doc.roles || "—"}
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-top text-xs">
                <a
                  href={`/dynamic-resource-docs/system/${doc.dynamic_resource_doc_id}`}
                  data-testid="view-link"
                  class="mr-3 hover:underline ui-link"
                >View / Edit</a>
                <button
                  type="button"
                  onclick={() => deleteDoc(doc.dynamic_resource_doc_id)}
                  data-testid="delete-btn"
                  class="hover:underline ui-text-error"
                >Delete</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
