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
    FolderOpen,
    ArrowLeft,
    Edit,
    Trash2,
    Share2,
    Lock,
    Plus,
    X,
    Code,
    AlertCircle,
  } from "@lucide/svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import { invalidateAll } from "$app/navigation";

  let { data } = $props<{ data: PageData }>();

  let collection = $derived(data.collection);
  let endpoints = $derived(data.endpoints || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  // Add endpoint state
  let newOperationId = $state("");
  let isAddingEndpoint = $state(false);

  async function handleAddEndpoint(event: Event) {
    event.preventDefault();

    if (!newOperationId.trim()) {
      toast.error("Validation Error", "Operation ID is required");
      return;
    }

    if (!collection) return;

    isAddingEndpoint = true;

    try {
      const response = await trackedFetch(
        `/backend/api-collections/${collection.api_collection_id}/endpoints`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            operation_id: newOperationId.trim(),
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      toast.success("Endpoint Added", `Added ${newOperationId} to collection`);
      newOperationId = "";

      // Refresh the page data
      await invalidateAll();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to add endpoint";
      toast.error("Error", errorMessage);
    } finally {
      isAddingEndpoint = false;
    }
  }

  async function handleRemoveEndpoint(
    endpointId: string,
    operationId: string,
  ) {
    if (!collection) return;

    try {
      const response = await trackedFetch(
        `/proxy/obp/v6.0.0/my/api-collection-ids/${collection.api_collection_id}/api-collection-endpoint-ids/${endpointId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      toast.success(
        "Endpoint Removed",
        `Removed ${operationId} from collection`,
      );

      // Refresh the page data
      await invalidateAll();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to remove endpoint";
      toast.error("Error", errorMessage);
    }
  }
</script>

<svelte:head>
  <title
    >{collection ? collection.api_collection_name : "Collection"} - API Manager II</title
  >
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb mb-6">
    <a href="/api-collections" class="breadcrumb-link">My Collections</a>
    <span class="breadcrumb-separator">></span>
    <span class="breadcrumb-current"
      >{collection?.api_collection_name || "Collection Detail"}</span
    >
  </nav>

  {#if error && !hasApiAccess}
    <div class="error-message">
      <p>{error}</p>
    </div>
  {:else if !collection}
    <div class="error-message">
      <p>Collection not found</p>
    </div>
  {:else}
    <div class="panel">
      <!-- Header -->
      <div class="panel-header">
        <div class="header-content">
          <div class="header-left">
            <div class="header-icon">
              <FolderOpen size={32} />
            </div>
            <div>
              <div class="header-title-row">
                <h1 class="panel-title">{collection.api_collection_name}</h1>
                {#if collection.is_sharable}
                  <span class="status-badge status-shared">
                    <Share2 size={14} />
                    Shared
                  </span>
                {:else}
                  <span class="status-badge status-private">
                    <Lock size={14} />
                    Private
                  </span>
                {/if}
              </div>
              <div class="panel-subtitle">
                {collection.description || "No description"}
              </div>
            </div>
          </div>
          <div class="header-actions">
            <a href="/api-collections" class="btn-secondary">
              <ArrowLeft size={16} />
              Back to Collections
            </a>
            <a
              href="/api-collections/{collection.api_collection_id}/edit"
              class="btn-secondary"
            >
              <Edit size={16} />
              Edit
            </a>
            <a
              href="/api-collections/{collection.api_collection_id}/delete"
              class="btn-danger"
            >
              <Trash2 size={16} />
              Delete
            </a>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="panel-content">
        <!-- Collection Info Section -->
        <section class="info-section">
          <h2 class="section-title">Collection Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Collection ID</div>
              <div class="info-value">{collection.api_collection_id}</div>
            </div>
            <div class="info-item">
              <div class="info-label">User ID</div>
              <div class="info-value">{collection.user_id}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Sharing</div>
              <div class="info-value">
                {collection.is_sharable ? "Shared (Public)" : "Private"}
              </div>
            </div>
          </div>
        </section>

        <!-- Add Endpoint Section -->
        <section class="info-section">
          <h2 class="section-title">Add Endpoint</h2>
          <form onsubmit={handleAddEndpoint} class="add-endpoint-form">
            <div class="form-row">
              <input
                type="text"
                class="form-input"
                placeholder="e.g., OBPv4.0.0-getBanks"
                bind:value={newOperationId}
                disabled={isAddingEndpoint}
              />
              <button
                type="submit"
                class="btn-primary"
                disabled={isAddingEndpoint || !newOperationId.trim()}
              >
                {#if isAddingEndpoint}
                  Adding...
                {:else}
                  <Plus size={16} />
                  Add Endpoint
                {/if}
              </button>
            </div>
            <div class="form-help">
              Enter the OBP API operation ID (e.g., OBPv4.0.0-getBanks,
              OBPv5.0.0-createTransaction)
            </div>
          </form>
        </section>

        <!-- Endpoints Section -->
        <section class="info-section">
          <h2 class="section-title">
            <Code size={20} />
            Endpoints ({endpoints.length})
          </h2>
          {#if endpoints.length > 0}
            <div class="endpoints-grid">
              {#each endpoints as endpoint}
                <div class="endpoint-card">
                  <div class="endpoint-info">
                    <div class="endpoint-icon">
                      <Code size={16} />
                    </div>
                    <span class="endpoint-name">{endpoint.operation_id}</span>
                  </div>
                  <button
                    type="button"
                    class="btn-remove"
                    onclick={() =>
                      handleRemoveEndpoint(
                        endpoint.api_collection_endpoint_id,
                        endpoint.operation_id,
                      )}
                    title="Remove endpoint"
                  >
                    <X size={16} />
                  </button>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state-small">
              <AlertCircle size={32} />
              <p>No endpoints in this collection</p>
              <p class="empty-state-hint">
                Add endpoints using the form above
              </p>
            </div>
          {/if}
        </section>
      </div>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1200px;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .breadcrumb-link {
    color: #3b82f6;
    text-decoration: none;
  }

  .breadcrumb-link:hover {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .breadcrumb-link {
    color: rgb(var(--color-primary-400));
  }

  .breadcrumb-separator {
    color: #9ca3af;
  }

  :global([data-mode="dark"]) .breadcrumb-separator {
    color: var(--color-surface-500);
  }

  .breadcrumb-current {
    color: #6b7280;
  }

  :global([data-mode="dark"]) .breadcrumb-current {
    color: var(--color-surface-400);
  }

  .error-message {
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #991b1b;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .error-message {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: rgb(var(--color-error-200));
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
    padding: 2rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
  }

  .header-left {
    display: flex;
    align-items: flex-start;
    gap: 1.5rem;
    flex: 1;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: #eff6ff;
    color: #3b82f6;
    border-radius: 12px;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .header-icon {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-400));
  }

  .header-title-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .panel-title {
    font-size: 1.875rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    line-height: 1.5;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.875rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .status-shared {
    background: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"]) .status-shared {
    background: rgba(16, 185, 129, 0.2);
    color: rgb(var(--color-success-300));
  }

  .status-private {
    background: #f3f4f6;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .status-private {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-400);
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    white-space: nowrap;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-primary {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-primary:hover:not(:disabled) {
    background: rgb(var(--color-primary-700));
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-secondary {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .btn-secondary:hover:not(:disabled) {
    background: rgb(var(--color-surface-600));
  }

  .btn-danger {
    background: #fef2f2;
    color: #dc2626;
  }

  .btn-danger:hover:not(:disabled) {
    background: #fee2e2;
  }

  .btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-danger {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(var(--color-error-400));
  }

  :global([data-mode="dark"]) .btn-danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
  }

  .panel-content {
    padding: 2rem;
  }

  .info-section {
    margin-bottom: 2.5rem;
  }

  .info-section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 1.5rem 0;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .section-title {
    color: var(--color-surface-100);
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .info-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .info-label {
    color: var(--color-surface-400);
  }

  .info-value {
    font-size: 0.875rem;
    color: #111827;
    font-weight: 500;
    word-break: break-all;
  }

  :global([data-mode="dark"]) .info-value {
    color: var(--color-surface-200);
  }

  .add-endpoint-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-row {
    display: flex;
    gap: 1rem;
  }

  .form-input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-input:disabled {
    background: #f9fafb;
    cursor: not-allowed;
    opacity: 0.6;
  }

  :global([data-mode="dark"]) .form-input {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .form-input:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  :global([data-mode="dark"]) .form-input:disabled {
    background: rgb(var(--color-surface-800));
  }

  .form-help {
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .form-help {
    color: var(--color-surface-400);
  }

  .endpoints-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .endpoint-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1rem;
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .endpoint-card:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
  }

  :global([data-mode="dark"]) .endpoint-card {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  :global([data-mode="dark"]) .endpoint-card:hover {
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-600));
  }

  .endpoint-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .endpoint-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: #eff6ff;
    color: #3b82f6;
    border-radius: 6px;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .endpoint-icon {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-400));
  }

  .endpoint-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #111827;
    word-wrap: break-word;
    overflow-wrap: break-word;
    min-width: 0;
  }

  :global([data-mode="dark"]) .endpoint-name {
    color: var(--color-surface-200);
  }

  .btn-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: #fef2f2;
    color: #dc2626;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .btn-remove:hover {
    background: #fee2e2;
  }

  :global([data-mode="dark"]) .btn-remove {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(var(--color-error-400));
  }

  :global([data-mode="dark"]) .btn-remove:hover {
    background: rgba(239, 68, 68, 0.2);
  }

  .empty-state-small {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    background: #fafafa;
    border: 1px dashed #d1d5db;
    border-radius: 6px;
    color: #9ca3af;
    text-align: center;
  }

  :global([data-mode="dark"]) .empty-state-small {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
    color: var(--color-surface-500);
  }

  .empty-state-small p {
    margin: 0;
    font-size: 0.875rem;
  }

  .empty-state-hint {
    font-size: 0.75rem !important;
    color: #d1d5db !important;
  }

  :global([data-mode="dark"]) .empty-state-hint {
    color: var(--color-surface-600) !important;
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
      flex-wrap: wrap;
    }

    .btn-secondary,
    .btn-danger {
      flex: 1;
      justify-content: center;
      min-width: 120px;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .endpoints-grid {
      grid-template-columns: 1fr;
    }

    .header-title-row {
      flex-direction: column;
      align-items: flex-start;
    }

    .form-row {
      flex-direction: column;
    }
  }
</style>
