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
  import { goto } from "$app/navigation";
  import { FolderOpen, ArrowLeft, Share2 } from "@lucide/svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  let { data } = $props<{ data: PageData }>();

  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  // Form state
  let collectionName = $state("");
  let description = $state("");
  let isSharable = $state(false);
  let isSubmitting = $state(false);

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!collectionName.trim()) {
      toast.error("Validation Error", "Collection name is required");
      return;
    }

    isSubmitting = true;

    try {
      const requestBody = {
        api_collection_name: collectionName.trim(),
        description: description.trim(),
        is_sharable: isSharable,
      };

      const response = await trackedFetch("/backend/api-collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      toast.success(
        "Collection Created",
        `Successfully created ${collectionName}`,
      );

      // Redirect to collections list after short delay
      setTimeout(() => {
        goto("/api-collections");
      }, 1000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create collection";
      toast.error("Error", errorMessage);
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    goto("/api-collections");
  }
</script>

<svelte:head>
  <title>Create Collection - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb mb-6">
    <a href="/api-collections" class="breadcrumb-link">My Collections</a>
    <span class="breadcrumb-separator">></span>
    <span class="breadcrumb-current">Create Collection</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-icon">
          <FolderOpen size={32} />
        </div>
        <div>
          <h1 class="panel-title">Create Collection</h1>
          <div class="panel-subtitle">
            Create a new collection to organize your favorite API endpoints
          </div>
        </div>
      </div>
    </div>

    <div class="panel-content">
      {#if error && !hasApiAccess}
        <div class="error-message">
          <p>{error}</p>
        </div>
      {/if}

      <form onsubmit={handleSubmit} class="form">
        <!-- Collection Name -->
        <div class="form-group">
          <label for="collection-name" class="form-label">
            <FolderOpen size={16} />
            Collection Name
            <span class="required">*</span>
          </label>
          <input
            id="collection-name"
            type="text"
            class="form-input"
            placeholder="e.g., Favourites, Payment APIs, Account Endpoints"
            bind:value={collectionName}
            disabled={isSubmitting}
            required
          />
          <div class="form-help">A unique name to identify this collection</div>
        </div>

        <!-- Description -->
        <div class="form-group">
          <label for="description" class="form-label">
            Description
          </label>
          <textarea
            id="description"
            class="form-textarea"
            placeholder="e.g., My most frequently used API endpoints"
            bind:value={description}
            disabled={isSubmitting}
            rows="4"
          ></textarea>
          <div class="form-help">
            Optional description of this collection (max 2000 characters)
          </div>
        </div>

        <!-- Is Sharable -->
        <div class="form-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              class="checkbox-input"
              bind:checked={isSharable}
              disabled={isSubmitting}
            />
            <span class="checkbox-text">
              <Share2 size={16} />
              Make this collection sharable (public)
            </span>
          </label>
          <div class="form-help">
            If enabled, other users can view this collection
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="form-actions">
          <button
            type="button"
            class="btn-secondary"
            onclick={handleCancel}
            disabled={isSubmitting}
          >
            <ArrowLeft size={16} />
            Cancel
          </button>
          <button type="submit" class="btn-primary" disabled={isSubmitting}>
            {#if isSubmitting}
              Creating...
            {:else}
              <FolderOpen size={16} />
              Create Collection
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 800px;
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
    align-items: center;
    gap: 1rem;
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

  .panel-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--ui-text);
    margin: 0;
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: var(--ui-muted);
    margin-top: 0.25rem;
  }

  .panel-content {
    padding: 2rem;
  }

  .error-message {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--ui-tone-error-bg);
    border: 1px solid var(--ui-tone-error-border);
    border-radius: 6px;
    color: var(--ui-tone-error-text);
    font-size: 0.875rem;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ui-text);
  }

  .required {
    color: var(--ui-error);
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-link) 10%, transparent);
  }

  .form-input:disabled,
  .form-textarea:disabled {
    background: var(--ui-card);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
  }

  .form-help {
    font-size: 0.75rem;
    color: var(--ui-muted);
  }

  .checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    cursor: pointer;
  }

  .checkbox-input {
    width: 1.25rem;
    height: 1.25rem;
    margin-top: 0.125rem;
    cursor: pointer;
  }

  .checkbox-text {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--ui-text);
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid var(--ui-border);
  }

  .btn-primary,
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--ui-fill-main-bg);
    color: var(--ui-fill-main-text);
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.85;
  }

  .btn-primary:disabled {
    opacity: 0.6;
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
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .form-actions {
      flex-direction: column-reverse;
    }

    .btn-primary,
    .btn-secondary {
      width: 100%;
      justify-content: center;
    }

    .header-content {
      flex-direction: column;
      text-align: center;
    }
  }
</style>
