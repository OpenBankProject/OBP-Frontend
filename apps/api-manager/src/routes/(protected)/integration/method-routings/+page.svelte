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
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { fetchMethodRoutings as loadRoutings, isDefaultRouting, type MethodRouting } from "$lib/services/methodRoutings";

  // Creating, overriding and editing live on their own pages (with Opey beside the form):
  // /integration/method-routings/create[?method=NAME|?from=ID] and /integration/method-routings/ID.
  let methodRoutings = $state<MethodRouting[]>([]);
  let viewMode = $state<"active" | "configured">("active");
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);

  async function fetchMethodRoutings() {
    try {
      isLoading = true;
      error = null;
      methodRoutings = await loadRoutings(viewMode === "active");
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch method routings";
      console.error("Error fetching method routings:", err);
    } finally {
      isLoading = false;
    }
  }

  function clearMessages() {
    error = null;
    successMessage = null;
  }

  function switchViewMode(mode: "active" | "configured") {
    viewMode = mode;
    fetchMethodRoutings();
  }

  onMount(() => {
    const saved = page.url.searchParams.get("saved");
    const deleted = page.url.searchParams.get("deleted");
    if (saved) successMessage = `Method routing for ${saved} saved`;
    if (deleted) successMessage = `Method routing for ${deleted} deleted`;
    fetchMethodRoutings();
  });
</script>

<svelte:head>
  <title>Method Routings - Integration - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="header mb-6">
    <div>
      <h1 class="text-2xl font-bold">Method Routings</h1>
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Manage method routing configurations for the OBP API
      </p>
    </div>
    <a href="/integration/method-routings/create" class="btn btn-primary" data-testid="create-method-routing">
      Create Method Routing
    </a>
  </div>

  <!-- Messages -->
  {#if error}
    <div class="alert alert-error mb-6">
      <strong>Error:</strong>
      {error}
      <button onclick={clearMessages} class="alert-close">×</button>
    </div>
  {/if}

  {#if successMessage}
    <div class="alert alert-success mb-6">
      <strong>Success:</strong>
      {successMessage}
      <button onclick={clearMessages} class="alert-close">×</button>
    </div>
  {/if}

  <!-- Method Routings List -->
  <div class="panel">
    <div class="panel-header panel-header-with-actions">
      <h2 class="panel-title">Method Routings List</h2>
      <div class="view-toggle">
        <button
          onclick={() => switchViewMode("active")}
          class="btn {viewMode === 'active' ? 'btn-toggle-active' : 'btn-toggle-inactive'}"
          disabled={isLoading}
        >
          Active
        </button>
        <button
          onclick={() => switchViewMode("configured")}
          class="btn {viewMode === 'configured' ? 'btn-toggle-active' : 'btn-toggle-inactive'}"
          disabled={isLoading}
        >
          Configured
        </button>
      </div>
    </div>
    <div class="panel-content">
      {#if isLoading && methodRoutings.length === 0}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading method routings...</p>
        </div>
      {:else if methodRoutings.length > 0}
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Method Name</th>
                <th>Connector Name</th>
                <th>Bank ID Pattern</th>
                <th>Exact Match</th>
                {#if viewMode === "active"}
                  <th>Source</th>
                {/if}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each methodRoutings as routing}
                <tr class={isDefaultRouting(routing) ? "row-default" : ""}>
                  <td class="font-mono text-sm {isDefaultRouting(routing) ? '' : 'method-name-custom'}">{routing.method_name}</td>
                  <td>
                    <span class="badge {routing.connector_name === 'mapped' ? 'badge-connector-mapped' : 'badge-connector-custom'}">
                      {routing.connector_name}
                    </span>
                  </td>
                  <td class="font-mono text-sm">
                    {routing.bank_id_pattern || "N/A"}
                  </td>
                  <td>
                    <span
                      class="badge {routing.is_bank_id_exact_match
                        ? 'badge-success'
                        : 'badge-default'}"
                    >
                      {routing.is_bank_id_exact_match ? "Yes" : "No"}
                    </span>
                  </td>
                  {#if viewMode === "active"}
                    <td>
                      <span class="badge {isDefaultRouting(routing) ? 'badge-default' : 'badge-custom'}">
                        {isDefaultRouting(routing) ? "Default" : "Custom"}
                      </span>
                    </td>
                  {/if}
                  <td>
                    {#if isDefaultRouting(routing)}
                      <a
                        href="/integration/method-routings/create?method={encodeURIComponent(routing.method_name)}"
                        class="btn-icon"
                        data-testid="override-{routing.method_name}"
                      >
                        Override
                      </a>
                    {:else}
                      <a
                        href="/integration/method-routings/{routing.method_routing_id}"
                        class="btn-icon"
                        data-testid="edit-{routing.method_name}"
                      >
                        Edit
                      </a>
                      <a
                        href="/integration/method-routings/create?from={routing.method_routing_id}"
                        class="btn-icon"
                        data-testid="duplicate-{routing.method_name}"
                      >
                        Duplicate
                      </a>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          {#if viewMode === "active"}
            {@const customCount = methodRoutings.filter((r) => !isDefaultRouting(r)).length}
            {@const defaultCount = methodRoutings.filter((r) => isDefaultRouting(r)).length}
            Showing {methodRoutings.length} active method routing{methodRoutings.length !== 1 ? "s" : ""} ({customCount} custom, {defaultCount} default)
          {:else}
            Showing {methodRoutings.length} method routing{methodRoutings.length !== 1 ? "s" : ""}
          {/if}
        </div>
      {:else}
        <div class="empty-state">
          <p>No method routings found</p>
          <a href="/integration/method-routings/create" class="btn btn-primary mt-4">
            Create Your First Method Routing
          </a>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1600px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .panel {
    background: white;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  :global([data-mode="dark"]) .panel {
    background: rgb(var(--color-surface-800));
  }

  .panel-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .panel-header-with-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .view-toggle {
    display: flex;
    gap: 0;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    overflow: hidden;
  }

  .btn-toggle-active {
    background: #3b82f6;
    color: white;
    border-radius: 0;
  }

  .btn-toggle-inactive {
    background: white;
    color: #374151;
    border-radius: 0;
  }

  .btn-toggle-inactive:hover:not(:disabled) {
    background: #f3f4f6;
  }

  :global([data-mode="dark"]) .view-toggle {
    border-color: rgb(var(--color-surface-600));
  }

  :global([data-mode="dark"]) .btn-toggle-active {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-toggle-inactive {
    background: rgb(var(--color-surface-800));
    color: var(--color-surface-300);
  }

  :global([data-mode="dark"]) .btn-toggle-inactive:hover:not(:disabled) {
    background: rgb(var(--color-surface-700));
  }

  .panel-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-content {
    padding: 1.5rem;
  }

.btn {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  :global([data-mode="dark"]) .btn-primary {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-primary:hover:not(:disabled) {
    background: rgb(var(--color-primary-500));
  }

.btn-icon {
    padding: 0.625rem 1.5rem;
    font-size: 0.8125rem;
    background: transparent;
    color: #3b82f6;
    border: 1px solid #3b82f6;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-icon:hover:not(:disabled) {
    background: #3b82f6;
    color: white;
  }

  :global([data-mode="dark"]) .btn-icon {
    color: rgb(var(--color-primary-400));
    border-color: rgb(var(--color-primary-400));
  }

  :global([data-mode="dark"]) .btn-icon:hover:not(:disabled) {
    background: rgb(var(--color-primary-400));
    color: rgb(var(--color-surface-900));
  }

  .table-wrapper {
    overflow-x: auto;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
  }

  :global([data-mode="dark"]) .table-wrapper {
    border-color: rgb(var(--color-surface-700));
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
  }

  .data-table th {
    text-align: left;
    padding: 0.75rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
    background: #f9fafb;
    border-bottom: 2px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .data-table th {
    color: var(--color-surface-300);
    background: rgb(var(--color-surface-700));
    border-bottom-color: rgb(var(--color-surface-600));
  }

  .data-table td {
    padding: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.875rem;
    color: #111827;
  }

  :global([data-mode="dark"]) .data-table td {
    border-bottom-color: rgb(var(--color-surface-700));
    color: var(--color-surface-100);
  }

  .data-table tbody tr:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .data-table tbody tr:hover {
    background: rgb(var(--color-surface-700));
  }

  .data-table tbody tr:last-child td {
    border-bottom: none;
  }

  .table-footer {
    padding: 0.75rem;
    font-size: 0.875rem;
    color: #6b7280;
    text-align: right;
  }

  :global([data-mode="dark"]) .table-footer {
    color: var(--color-surface-400);
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .badge-success {
    background: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"]) .badge-success {
    background: rgb(var(--color-success-900));
    color: rgb(var(--color-success-200));
  }

  .badge-default {
    background: #e5e7eb;
    color: #374151;
  }

  :global([data-mode="dark"]) .badge-default {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-300);
  }

  .badge-custom {
    background: #fff7ed;
    color: #9a3412;
    border: 1px solid #fdba74;
  }

  :global([data-mode="dark"]) .badge-custom {
    background: #431407;
    color: #fed7aa;
    border-color: #9a3412;
  }

  .badge-connector-mapped {
    background: #e5e7eb;
    color: #374151;
  }

  :global([data-mode="dark"]) .badge-connector-mapped {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-300);
  }

  .badge-connector-custom {
    background: #f3e8ff;
    color: #6b21a8;
    border: 1px solid #c084fc;
  }

  :global([data-mode="dark"]) .badge-connector-custom {
    background: #3b0764;
    color: #e9d5ff;
    border-color: #7e22ce;
  }

  .method-name-custom {
    color: #2563eb;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .method-name-custom {
    color: rgb(var(--color-primary-400));
  }

  .row-default {
    opacity: 0.75;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .alert-error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  :global([data-mode="dark"]) .alert-error {
    background: rgb(var(--color-error-900));
    color: rgb(var(--color-error-200));
    border-color: rgb(var(--color-error-800));
  }

  .alert-success {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }

  :global([data-mode="dark"]) .alert-success {
    background: rgb(var(--color-success-900));
    color: rgb(var(--color-success-200));
    border-color: rgb(var(--color-success-800));
  }


  .alert-close {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
  }

  .alert-close:hover {
    opacity: 1;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    gap: 1rem;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  :global([data-mode="dark"]) .spinner {
    border-color: rgb(var(--color-surface-700));
    border-top-color: rgb(var(--color-primary-400));
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
  }

  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      align-items: stretch;
    }

}
</style>
