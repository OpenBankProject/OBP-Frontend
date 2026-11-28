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
        `/proxy/obp/v5.1.0/my/api-collection-ids/${collection.api_collection_id}/api-collection-endpoint-ids/${endpointId}`,
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
    color: var(--ui-link);
    text-decoration: none;
  }

  .breadcrumb-link:hover {
    text-decoration: underline;
  }

  .breadcrumb-separator {
    color: var(--ui-muted);
  }

  .breadcrumb-current {
    color: var(--ui-muted);
  }

  .error-message {
    padding: 1rem;
    background: var(--ui-tone-error-bg);
    border: 1px solid var(--ui-tone-error-border);
    border-radius: 6px;
    color: var(--ui-tone-error-text);
    font-size: 0.875rem;
  }

  .panel {
    background: var(--ui-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .panel-header {
    padding: 2rem;
    border-bottom: 1px solid var(--ui-border);
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
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    border-radius: 12px;
    flex-shrink: 0;
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
    color: var(--ui-text);
    margin: 0;
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: var(--ui-muted);
    line-height: 1.5;
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
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .status-private {
    background: var(--ui-panel);
    color: var(--ui-muted);
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
    background: var(--ui-fill-main-bg);
    color: var(--ui-fill-main-text);
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.85;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--ui-panel);
    color: var(--ui-text);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--ui-hover);
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-danger {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
  }

  .btn-danger:hover:not(:disabled) {
    background: var(--ui-tone-error-bg);
  }

  .btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    color: var(--ui-text);
    margin: 0 0 1.5rem 0;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid var(--ui-border);
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
    color: var(--ui-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .info-value {
    font-size: 0.875rem;
    color: var(--ui-text);
    font-weight: 500;
    word-break: break-all;
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
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .form-input:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-link) 10%, transparent);
  }

  .form-input:disabled {
    background: var(--ui-card);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .form-help {
    font-size: 0.75rem;
    color: var(--ui-muted);
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
    background: var(--ui-card);
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    transition: all 0.2s;
  }

  .endpoint-card:hover {
    background: var(--ui-hover);
    border-color: var(--ui-border);
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
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    border-radius: 6px;
    flex-shrink: 0;
  }

  .endpoint-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--ui-text);
    word-wrap: break-word;
    overflow-wrap: break-word;
    min-width: 0;
  }

  .btn-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .btn-remove:hover {
    background: var(--ui-tone-error-bg);
  }

  .empty-state-small {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    background: var(--ui-card);
    border: 1px dashed var(--ui-border);
    border-radius: 6px;
    color: var(--ui-muted);
    text-align: center;
  }

  .empty-state-small p {
    margin: 0;
    font-size: 0.875rem;
  }

  .empty-state-hint {
    font-size: 0.75rem !important;
    color: var(--ui-muted) !important;
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
