<script lang="ts">
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";
  import { page } from "$app/stores";
  import DynamicEndpointOperationsTable from "$lib/components/DynamicEndpointOperationsTable.svelte";

  let { data }: { data: PageData } = $props();

  const endpoint = data.endpoint;
  const bankId = data.bank_id;
  const swagger = endpoint?.swagger_string || {};

  const apiExplorerUrl =
    $page.data.externalLinks?.API_EXPLORER_URL ||
    "https://apiexplorer-ii-sandbox.openbankproject.com";

  // Extract endpoint info from swagger
  function getSwaggerInfo() {
    return {
      title: swagger?.info?.title || "Untitled",
      description: swagger?.info?.description || "No description",
      version: swagger?.info?.version || "N/A",
      host: swagger?.host || "Not specified",
      basePath: swagger?.basePath || "/",
    };
  }

  const info = getSwaggerInfo();

  // Host update state
  let newHost = $state(info.host);
  let isUpdatingHost = $state(false);
  let hostUpdateError = $state("");
  let hostUpdateSuccess = $state(false);

  async function updateHost() {
    if (!newHost.trim()) {
      hostUpdateError = "Host is required";
      return;
    }

    isUpdatingHost = true;
    hostUpdateError = "";
    hostUpdateSuccess = false;

    try {
      const response = await fetch(
        `/backend/dynamic-endpoints/bank/${bankId}/${endpoint.dynamic_endpoint_id}/host`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ host: newHost }),
        },
      );

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to update host",
        );
        logErrorDetails("Update Bank Dynamic Endpoint Host", errorDetails);
        hostUpdateError = formatErrorForDisplay(errorDetails);
        return;
      }

      hostUpdateSuccess = true;
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      hostUpdateError =
        error instanceof Error ? error.message : "Failed to update host";
    } finally {
      isUpdatingHost = false;
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Are you sure you want to delete this dynamic endpoint?`,
      )
    ) {
      return;
    }

    try {
      const response = await fetch(
        `/proxy/obp/v6.0.0/management/banks/${bankId}/dynamic-endpoints/${endpoint.dynamic_endpoint_id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to delete endpoint",
        );
        logErrorDetails("Delete Bank Dynamic Endpoint", errorDetails);
        const errorMessage = formatErrorForDisplay(errorDetails);
        throw new Error(errorMessage);
      }

      alert("Bank dynamic endpoint deleted successfully");
      goto("/dynamic-endpoints/bank");
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to delete endpoint";
      alert(`Error: ${errorMsg}`);
      console.error("Delete error:", error);
    }
  }

  let exportCopied = $state(false);

  async function exportDefinition() {
    const exportJson = JSON.stringify({ swagger_string: swagger }, null, 2);

    try {
      await navigator.clipboard.writeText(exportJson);
      exportCopied = true;
      setTimeout(() => {
        exportCopied = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      alert("Failed to copy to clipboard");
    }
  }

  async function downloadDefinition() {
    const exportJson = JSON.stringify({ swagger_string: swagger }, null, 2);

    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bank_dynamic_endpoint_${endpoint.dynamic_endpoint_id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

</script>

<svelte:head>
  <title>{info.title} - Bank Dynamic Endpoint - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-5xl px-4 py-8">
  <!-- Breadcrumb -->
  <div class="mb-6">
    <a
      href="/dynamic-endpoints/bank"
      class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    >
      <svg
        class="mr-2 h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 19l-7-7 7-7"
        />
      </svg>
      Back to Bank Dynamic Endpoints
    </a>

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {info.title}
        </h1>
        <p class="mt-1 text-gray-600 dark:text-gray-400">
          Bank Dynamic Endpoint Details - Bank: <span class="font-mono font-semibold">{bankId}</span>
        </p>
      </div>
      <div class="flex gap-2">
        <a
          href="{apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=OBPv4.0.0-getBankLevelDynamicEndpoint"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center rounded-lg border border-purple-300 bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 dark:border-purple-600 dark:bg-purple-500 dark:hover:bg-purple-600"
          title="Open in API Explorer"
        >
          <svg
            class="mr-2 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          API Explorer
        </a>
      </div>
    </div>
  </div>

  <!-- Endpoint Information Card -->
  <div
    class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
      Endpoint Information
    </h2>
    <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Endpoint ID
        </dt>
        <dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
          {endpoint.dynamic_endpoint_id}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Bank ID
        </dt>
        <dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
          {bankId}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          User ID
        </dt>
        <dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
          {endpoint.user_id}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Title
        </dt>
        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
          {info.title}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Version
        </dt>
        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
          {info.version}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Host
        </dt>
        <dd class="mt-1 text-sm">
          <span
            class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200"
          >
            {info.host}
          </span>
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Base Path
        </dt>
        <dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
          {info.basePath}
        </dd>
      </div>
      <div class="sm:col-span-2">
        <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
          Description
        </dt>
        <dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
          {info.description}
        </dd>
      </div>
    </dl>
  </div>

  <!-- Update Host Section -->
  <div
    class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
      Update Host
    </h2>
    <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
      Change where this dynamic endpoint routes requests to.
    </p>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div class="flex-1">
        <label
          for="host"
          class="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Host
        </label>
        <input
          type="text"
          id="host"
          bind:value={newHost}
          placeholder="obp_mock, dynamic_entity, or URL"
          class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
        />
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Options: <code class="bg-gray-100 px-1 dark:bg-gray-700">obp_mock</code>,
          <code class="bg-gray-100 px-1 dark:bg-gray-700">dynamic_entity</code>, or a URL like
          <code class="bg-gray-100 px-1 dark:bg-gray-700">https://api.example.com</code>
        </p>
      </div>
      <button
        type="button"
        onclick={updateHost}
        disabled={isUpdatingHost}
        class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        {#if isUpdatingHost}
          Updating...
        {:else}
          Update Host
        {/if}
      </button>
    </div>
    {#if hostUpdateError}
      <div class="mt-2 text-sm text-red-600 dark:text-red-400">
        {hostUpdateError}
      </div>
    {/if}
    {#if hostUpdateSuccess}
      <div class="mt-2 flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Host updated successfully! Reloading...
      </div>
    {/if}
  </div>

  <!-- Operations Section -->
  <div class="mb-6">
    <DynamicEndpointOperationsTable {swagger} validations={data.validations || []} mappings={data.mappings || []} bankId={bankId} />
  </div>

  <!-- Raw Swagger View -->
  <div
    class="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
  >
    <div class="border-b border-gray-200 p-6 dark:border-gray-700">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Raw Swagger Specification
      </h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Complete swagger specification in JSON format
      </p>
    </div>
    <div class="p-6">
      <pre
        class="max-h-96 overflow-auto rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-900"><code
          class="text-gray-900 dark:text-gray-100"
          >{JSON.stringify(swagger, null, 2)}</code
        ></pre>
    </div>
  </div>

  <!-- Action Buttons -->
  <div class="flex justify-end gap-2">
    <button
      type="button"
      onclick={exportDefinition}
      class="inline-flex items-center rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 dark:border-green-600 dark:bg-gray-800 dark:text-green-400 dark:hover:bg-green-900/20"
      title="Copy definition to clipboard"
    >
      {#if exportCopied}
        <svg
          class="mr-2 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
        Copied!
      {:else}
        <svg
          class="mr-2 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
        Copy Definition
      {/if}
    </button>
    <button
      type="button"
      onclick={downloadDefinition}
      class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      title="Download definition as JSON file"
    >
      <svg
        class="mr-2 h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      Download
    </button>
    <button
      type="button"
      onclick={handleDelete}
      class="inline-flex items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-600 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
    >
      <svg
        class="mr-2 h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
        />
      </svg>
      Delete Endpoint
    </button>
  </div>
</div>
