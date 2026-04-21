<script lang="ts">
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";
  import DynamicResourceDocForm, {
    type DynamicResourceDocFormValues,
  } from "$lib/components/DynamicResourceDocForm.svelte";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";

  let { data }: { data: PageData } = $props();

  const doc = $derived(data.doc);
  const docId = $derived(doc?.dynamic_resource_doc_id);

  let deleteError = $state<string | null>(null);
  let successMessage = $state<string | null>(null);
  let isDeleting = $state(false);

  async function handleSubmit(values: DynamicResourceDocFormValues) {
    if (!docId) throw new Error("Missing doc id");
    successMessage = null;
    const response = await fetch(
      `/proxy/obp/v4.0.0/management/dynamic-resource-docs/${encodeURIComponent(docId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      },
    );
    if (!response.ok) {
      const errorDetails = await extractErrorFromResponse(
        response,
        "Failed to update dynamic resource doc",
      );
      logErrorDetails("Update Dynamic Resource Doc", errorDetails);
      throw new Error(formatErrorForDisplay(errorDetails));
    }
    successMessage = "Saved.";
  }

  async function handleDelete() {
    if (!docId) return;
    deleteError = null;
    successMessage = null;
    isDeleting = true;
    try {
      const response = await fetch(
        `/proxy/obp/v4.0.0/management/dynamic-resource-docs/${encodeURIComponent(docId)}`,
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
      await goto("/dynamic-resource-docs/system");
    } finally {
      isDeleting = false;
    }
  }
</script>

<svelte:head>
  <title>Edit System Dynamic Resource Doc - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-8">
  <div class="mb-6">
    <a
      href="/dynamic-resource-docs/system"
      class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    >
      ← Back to System Dynamic Resource Docs
    </a>
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {doc?.partial_function_name || "Dynamic Resource Doc"}
        </h1>
        <p class="mt-1 text-gray-600 dark:text-gray-400">
          <span class="font-mono">{doc?.request_verb} {doc?.request_url}</span>
        </p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-500">
          Served at <code class="rounded bg-gray-100 px-1 dark:bg-gray-900">/obp/dynamic-resource-doc{doc?.request_url}</code>
          · id <code class="rounded bg-gray-100 px-1 dark:bg-gray-900">{docId}</code>
        </p>
      </div>
      <button
        type="button"
        onclick={handleDelete}
        disabled={isDeleting}
        data-testid="delete-btn"
        class="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
    </div>
  </div>

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

  <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    {#key docId}
      <DynamicResourceDocForm initial={doc} onSubmit={handleSubmit} submitLabel="Save Changes">
        {#snippet cancel()}
          <a
            href="/dynamic-resource-docs/system"
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </a>
        {/snippet}
      </DynamicResourceDocForm>
    {/key}
  </div>
</div>
