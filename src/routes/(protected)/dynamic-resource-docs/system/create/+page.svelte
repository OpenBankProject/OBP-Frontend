<script lang="ts">
  import { goto } from "$app/navigation";
  import DynamicResourceDocForm, {
    type DynamicResourceDocFormValues,
  } from "$lib/components/DynamicResourceDocForm.svelte";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";

  async function handleSubmit(values: DynamicResourceDocFormValues) {
    const response = await fetch(
      `/proxy/obp/v4.0.0/management/dynamic-resource-docs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      },
    );
    if (!response.ok) {
      const errorDetails = await extractErrorFromResponse(
        response,
        "Failed to create dynamic resource doc",
      );
      logErrorDetails("Create Dynamic Resource Doc", errorDetails);
      throw new Error(formatErrorForDisplay(errorDetails));
    }
    const created = await response.json();
    const id = created?.dynamic_resource_doc_id;
    if (id) {
      await goto(`/dynamic-resource-docs/system/${id}`);
    } else {
      await goto("/dynamic-resource-docs/system");
    }
  }
</script>

<svelte:head>
  <title>Create System Dynamic Resource Doc - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-8">
  <div class="mb-6">
    <a
      href="/dynamic-resource-docs/system"
      class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    >
      ← Back to System Dynamic Resource Docs
    </a>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
      Create System Dynamic Resource Doc
    </h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">
      Define a new endpoint by writing the Scala method body that handles it.
    </p>
  </div>

  <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    <DynamicResourceDocForm onSubmit={handleSubmit} submitLabel="Create Resource Doc">
      {#snippet cancel()}
        <a
          href="/dynamic-resource-docs/system"
          class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Cancel
        </a>
      {/snippet}
    </DynamicResourceDocForm>
  </div>
</div>
