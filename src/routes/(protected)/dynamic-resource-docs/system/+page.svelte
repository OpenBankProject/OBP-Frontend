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
      case "GET": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "POST": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "PUT": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "DELETE": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  }

  async function deleteDoc(id: string) {
    deleteError = null;
    successMessage = null;
    try {
      const response = await fetch(
        `/proxy/obp/v4.0.0/management/dynamic-resource-docs/${encodeURIComponent(id)}`,
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
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        System Dynamic Resource Docs
      </h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        Endpoints implemented by Scala method bodies compiled at runtime. Served under
        <code class="rounded bg-gray-100 px-1 dark:bg-gray-900">/obp/dynamic-resource-doc/...</code>
      </p>
    </div>
    <a
      href="/dynamic-resource-docs/system/create"
      data-testid="create-link"
      class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
    >
      Create Resource Doc
    </a>
  </div>

  {#if data.error}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
      {data.error}
    </div>
  {/if}
  {#if deleteError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="delete-error">
      {deleteError}
    </div>
  {/if}
  {#if successMessage}
    <div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300" data-testid="success-message">
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
      class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
    />
  </div>

  {#if filteredDocs.length === 0}
    <div class="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
      {#if (data.docs || []).length === 0}
        No dynamic resource docs yet. <a href="/dynamic-resource-docs/system/create" class="text-blue-600 hover:underline dark:text-blue-400">Create one</a> to get started.
      {:else}
        No docs match "{searchQuery}".
      {/if}
    </div>
  {:else}
    <div class="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Method</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">URL</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Function Name</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Summary</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Roles</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
          {#each filteredDocs as doc (doc.dynamic_resource_doc_id)}
            <tr data-testid="doc-row" data-doc-id={doc.dynamic_resource_doc_id}>
              <td class="whitespace-nowrap px-4 py-3 align-top">
                <span class="inline-flex w-16 items-center justify-center rounded px-2 py-0.5 text-xs font-medium {methodBadgeClass(doc.request_verb)}">
                  {doc.request_verb}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-top font-mono text-sm text-gray-900 dark:text-gray-100">
                {doc.request_url || "—"}
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-top text-sm text-gray-900 dark:text-gray-100">
                {doc.partial_function_name || "—"}
              </td>
              <td class="px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-300">
                {doc.summary || "—"}
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-top text-xs text-gray-600 dark:text-gray-400">
                {doc.roles || "—"}
              </td>
              <td class="whitespace-nowrap px-4 py-3 align-top text-xs">
                <a
                  href={`/dynamic-resource-docs/system/${doc.dynamic_resource_doc_id}`}
                  data-testid="view-link"
                  class="mr-3 text-blue-600 hover:underline dark:text-blue-400"
                >View / Edit</a>
                <button
                  type="button"
                  onclick={() => deleteDoc(doc.dynamic_resource_doc_id)}
                  data-testid="delete-btn"
                  class="text-red-600 hover:underline dark:text-red-400"
                >Delete</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
