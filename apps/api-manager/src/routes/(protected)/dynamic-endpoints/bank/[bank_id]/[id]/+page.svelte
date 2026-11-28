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
        `/proxy/obp/v5.1.0/management/banks/${bankId}/dynamic-endpoints/${endpoint.dynamic_endpoint_id}`,
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

<div class="container mx-auto max-w-7xl px-4 py-8">
  <!-- Breadcrumb -->
  <div class="mb-6">
    <a
      href="/dynamic-endpoints/bank"
      class="mb-4 inline-flex items-center text-sm ui-link"
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
        <h1 class="text-3xl font-bold ui-text">
          {info.title}
        </h1>
        <p class="mt-1 ui-muted">
          Bank Dynamic Endpoint Details - Bank: <span class="font-mono font-semibold">{bankId}</span>
        </p>
      </div>
      <div class="flex gap-2">
        <a
          href="{apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=OBPv4.0.0-getBankLevelDynamicEndpoint"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium preset-filled-primary-500"
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
    class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border"
  >
    <h2 class="mb-4 text-lg font-semibold ui-text">
      Endpoint Information
    </h2>
    <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <dt class="text-sm font-medium ui-muted">
          Endpoint ID
        </dt>
        <dd class="mt-1 font-mono text-sm ui-text">
          {endpoint.dynamic_endpoint_id}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium ui-muted">
          Bank ID
        </dt>
        <dd class="mt-1 font-mono text-sm ui-text">
          {bankId}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium ui-muted">
          User ID
        </dt>
        <dd class="mt-1 font-mono text-sm ui-text">
          {endpoint.user_id}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium ui-muted">
          Title
        </dt>
        <dd class="mt-1 text-sm ui-text">
          {info.title}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium ui-muted">
          Version
        </dt>
        <dd class="mt-1 text-sm ui-text">
          {info.version}
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium ui-muted">
          Host
        </dt>
        <dd class="mt-1 text-sm">
          <span
            class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ui-tone-info"
          >
            {info.host}
          </span>
        </dd>
      </div>
      <div>
        <dt class="text-sm font-medium ui-muted">
          Base Path
        </dt>
        <dd class="mt-1 font-mono text-sm ui-text">
          {info.basePath}
        </dd>
      </div>
      <div class="sm:col-span-2">
        <dt class="text-sm font-medium ui-muted">
          Description
        </dt>
        <dd class="mt-1 text-sm ui-text">
          {info.description}
        </dd>
      </div>
    </dl>
  </div>

  <!-- Update Host Section -->
  <div
    class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border"
  >
    <h2 class="mb-4 text-lg font-semibold ui-text">
      Update Host
    </h2>
    <p class="mb-4 text-sm ui-muted">
      Change where this dynamic endpoint routes requests to.
    </p>
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div class="flex-1">
        <label
          for="host"
          class="block text-sm font-medium ui-muted"
        >
          Host
        </label>
        <input
          type="text"
          id="host"
          bind:value={newHost}
          placeholder="obp_mock, dynamic_entity, or URL"
          class="mt-1 block w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 ui-card ui-text ui-border"
        />
        <p class="mt-1 text-xs ui-muted">
          Options: <code class="px-1 ui-panel">obp_mock</code>,
          <code class="px-1 ui-panel">dynamic_entity</code>, or a URL like
          <code class="px-1 ui-panel">https://api.example.com</code>
        </p>
      </div>
      <button
        type="button"
        onclick={updateHost}
        disabled={isUpdatingHost}
        class="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 preset-filled-primary-500"
      >
        {#if isUpdatingHost}
          Updating...
        {:else}
          Update Host
        {/if}
      </button>
    </div>
    {#if hostUpdateError}
      <div class="mt-2 text-sm ui-text-error">
        {hostUpdateError}
      </div>
    {/if}
    {#if hostUpdateSuccess}
      <div class="mt-2 flex items-center gap-1 text-sm ui-text-success">
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
    class="mb-6 rounded-lg border shadow-sm ui-card ui-border"
  >
    <div class="border-b p-6 ui-border">
      <h2 class="text-lg font-semibold ui-text">
        Raw Swagger Specification
      </h2>
      <p class="mt-1 text-sm ui-muted">
        Complete swagger specification in JSON format
      </p>
    </div>
    <div class="p-6">
      <pre
        class="max-h-96 overflow-auto rounded-lg p-4 text-sm ui-card"><code
          class="ui-text"
          >{JSON.stringify(swagger, null, 2)}</code
        ></pre>
    </div>
  </div>

  <!-- Action Buttons -->
  <div class="flex justify-end gap-2">
    <button
      type="button"
      onclick={exportDefinition}
      class="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium ui-card ui-tone-success"
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
      class="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border"
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
      class="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium ui-card ui-tone-error"
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
