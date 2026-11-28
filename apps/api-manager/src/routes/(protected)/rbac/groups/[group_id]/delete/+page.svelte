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
  import {
    Users,
    Building2,
    Shield,
    ArrowLeft,
    Trash2,
    AlertTriangle,
  } from "@lucide/svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  let { data } = $props<{ data: PageData }>();

  let group = $derived(data.group);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  let isDeleting = $state(false);

  async function handleDelete() {
    if (!group) return;

    isDeleting = true;

    try {
      const response = await trackedFetch(
        `/proxy/obp/v6.0.0/management/groups/${group.group_id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      toast.success(
        "Group Deleted",
        `Successfully deleted group ${group.group_name}`,
      );

      // Redirect to groups list after short delay
      setTimeout(() => {
        goto("/rbac/groups");
      }, 1000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete group";
      toast.error("Error", errorMessage);
      isDeleting = false;
    }
  }

  function handleCancel() {
    if (group) {
      goto(`/rbac/groups/${group.group_id}`);
    } else {
      goto("/rbac/groups");
    }
  }
</script>

<svelte:head>
  <title>Delete Group - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb mb-6">
    <a href="/rbac/groups" class="breadcrumb-link">Groups</a>
    <span class="breadcrumb-separator">›</span>
    {#if group}
      <a href="/rbac/groups/{group.group_id}" class="breadcrumb-link">
        {group.group_name}
      </a>
      <span class="breadcrumb-separator">›</span>
    {/if}
    <span class="breadcrumb-current">Delete</span>
  </nav>

  {#if error && !hasApiAccess}
    <div class="error-message">
      <p>⚠️ {error}</p>
    </div>
  {:else if !group}
    <div class="error-message">
      <p>⚠️ Group not found</p>
    </div>
  {:else}
    <div class="panel">
      <!-- Header -->
      <div class="panel-header">
        <div class="header-content">
          <div class="header-icon warning">
            <AlertTriangle size={32} />
          </div>
          <div>
            <h1 class="panel-title">Delete Group</h1>
            <div class="panel-subtitle">
              This action cannot be undone. Please review the details carefully.
            </div>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="panel-content">
        <!-- Warning Message -->
        <div class="warning-box">
          <div class="warning-icon">
            <AlertTriangle size={24} />
          </div>
          <div class="warning-content">
            <h3 class="warning-title">Are you sure you want to delete this group?</h3>
            <p class="warning-text">
              Deleting this group will remove it permanently from the system.
              This action cannot be undone.
            </p>
          </div>
        </div>

        <!-- Group Details -->
        <div class="details-section">
          <h2 class="section-title">Group Details</h2>

          <div class="detail-card">
            <div class="detail-row">
              <div class="detail-label">Group Name</div>
              <div class="detail-value highlight">{group.group_name}</div>
            </div>

            <div class="detail-row">
              <div class="detail-label">Group ID</div>
              <div class="detail-value code">{group.group_id}</div>
            </div>

            {#if group.bank_id}
              <div class="detail-row">
                <div class="detail-label">
                  <Building2 size={16} />
                  Bank ID
                </div>
                <div class="detail-value">{group.bank_id}</div>
              </div>
            {/if}

            <div class="detail-row">
              <div class="detail-label">Description</div>
              <div class="detail-value">{group.group_description}</div>
            </div>

            <div class="detail-row">
              <div class="detail-label">Status</div>
              <div class="detail-value">
                {#if group.is_enabled}
                  <span class="status-badge status-enabled">Active</span>
                {:else}
                  <span class="status-badge status-disabled">Disabled</span>
                {/if}
              </div>
            </div>

            {#if group.list_of_roles && group.list_of_roles.length > 0}
              <div class="detail-row">
                <div class="detail-label">
                  <Shield size={16} />
                  Roles ({group.list_of_roles.length})
                </div>
                <div class="detail-value">
                  <div class="roles-list">
                    {#each group.list_of_roles as role}
                      <span class="role-chip">{role}</span>
                    {/each}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="form-actions">
          <button
            type="button"
            class="btn-secondary"
            onclick={handleCancel}
            disabled={isDeleting}
          >
            <ArrowLeft size={16} />
            Cancel
          </button>
          <button
            type="button"
            class="btn-danger"
            onclick={handleDelete}
            disabled={isDeleting}
          >
            {#if isDeleting}
              ⏳ Deleting...
            {:else}
              <Trash2 size={16} />
              Delete Group
            {/if}
          </button>
        </div>
      </div>
    </div>
  {/if}
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
    background: var(--ui-tone-error-bg);
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
    border-radius: 12px;
    flex-shrink: 0;
  }

  .header-icon.warning {
    background: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
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

  .warning-box {
    display: flex;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--ui-tone-warning-bg);
    border: 2px solid var(--ui-tone-warning-border);
    border-radius: 8px;
    margin-bottom: 2rem;
  }

  .warning-icon {
    display: flex;
    align-items: flex-start;
    color: var(--ui-warning);
    flex-shrink: 0;
  }

  .warning-content {
    flex: 1;
  }

  .warning-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--ui-warning);
    margin: 0 0 0.5rem 0;
  }

  .warning-text {
    font-size: 0.875rem;
    color: var(--ui-warning);
    margin: 0;
    line-height: 1.5;
  }

  .details-section {
    margin-bottom: 2rem;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0 0 1rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid var(--ui-border);
  }

  .detail-card {
    background: var(--ui-card);
    border: 1px solid var(--ui-border);
    border-radius: 8px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .detail-row {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 1rem;
    align-items: flex-start;
  }

  .detail-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ui-muted);
  }

  .detail-value {
    font-size: 0.875rem;
    color: var(--ui-text);
    word-break: break-word;
  }

  .detail-value.highlight {
    font-weight: 600;
    font-size: 1rem;
    color: var(--ui-error);
  }

  .detail-value.code {
    font-family: monospace;
    background: var(--ui-panel);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8125rem;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.875rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .status-enabled {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .status-disabled {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
  }

  .roles-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .role-chip {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    background: var(--ui-tone-accent-bg);
    color: var(--ui-tone-accent-text);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding-top: 1.5rem;
    border-top: 1px solid var(--ui-border);
  }

  .btn-secondary,
  .btn-danger {
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

  .btn-danger {
    background: var(--ui-fill-danger-bg);
    color: var(--ui-fill-danger-text);
  }

  .btn-danger:hover:not(:disabled) {
    opacity: 0.85;
  }

  .btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .form-actions {
      flex-direction: column-reverse;
    }

    .btn-secondary,
    .btn-danger {
      width: 100%;
      justify-content: center;
    }

    .detail-row {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .header-content {
      flex-direction: column;
      text-align: center;
    }

    .warning-box {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
  }
</style>
