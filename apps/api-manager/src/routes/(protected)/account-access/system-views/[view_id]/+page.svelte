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
    Eye,
    ArrowLeft,
    Shield,
    CheckCircle,
  } from "@lucide/svelte";

  let { data } = $props<{ data: PageData }>();

  let view = $derived(data.view);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  interface ActionGroup {
    label: string;
    actions: string[];
  }

  let groupedActions = $derived.by(() => {
    const actions: string[] = (view as any)?.allowed_actions || [];
    const groups: ActionGroup[] = [
      { label: "Transaction Permissions", actions: [] },
      { label: "Account Permissions", actions: [] },
      { label: "Counterparty Permissions", actions: [] },
      { label: "Write Permissions", actions: [] },
      { label: "Other Permissions", actions: [] },
    ];

    for (const action of actions) {
      if (action.includes("transaction")) {
        groups[0].actions.push(action);
      } else if (action.includes("bank_account") || action.includes("bank_routing")) {
        groups[1].actions.push(action);
      } else if (action.includes("other_account") || action.includes("other_bank") || action.includes("public_alias") || action.includes("private_alias") || action.includes("counterparty")) {
        groups[2].actions.push(action);
      } else if (action.startsWith("can_add_") || action.startsWith("can_delete_") || action.startsWith("can_edit_") || action.startsWith("can_create_")) {
        groups[3].actions.push(action);
      } else {
        groups[4].actions.push(action);
      }
    }

    return groups.filter((g) => g.actions.length > 0);
  });
</script>

<svelte:head>
  <title>{view ? view.short_name : "System View"} - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb mb-6">
    <a href="/account-access/system-views" class="breadcrumb-link"
      >System Views</a
    >
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">{view?.short_name || "View Detail"}</span>
  </nav>

  {#if error && !hasApiAccess}
    <div class="error-message">
      <p>⚠️ {error}</p>
    </div>
  {:else if !view}
    <div class="error-message">
      <p>⚠️ System view not found</p>
    </div>
  {:else}
    <div class="panel">
      <!-- Header -->
      <div class="panel-header">
        <div class="header-content">
          <div class="header-left">
            <div class="header-icon">
              <Eye size={32} />
            </div>
            <div>
              <div class="header-title-row">
                <h1 class="panel-title">{view.short_name}</h1>
                <div class="view-status">
                  {#if view.is_public}
                    <span class="status-badge status-public">
                      <CheckCircle size={14} />
                      Public
                    </span>
                  {/if}
                </div>
              </div>
              <div class="panel-subtitle">{view.description}</div>
            </div>
          </div>
          <div class="header-actions">
            <a
              href="/account-access/system-views/{view.view_id}/edit"
              class="btn-primary"
            >
              Update
            </a>
            <a href="/account-access/system-views" class="btn-secondary">
              <ArrowLeft size={16} />
              Back to Views
            </a>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="panel-content">
        <!-- Basic Info Section -->
        <!-- View Information -->
        <section class="info-section">
          <h2 class="section-title">View Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">View ID</div>
              <div class="info-value code">{view.short_name}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Description</div>
              <div class="info-value">{view.description}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Visibility</div>
              <div class="info-value">
                {view.is_public ? "Public" : "Private"}
              </div>
            </div>
            {#if view.alias}
              <div class="info-item">
                <div class="info-label">Alias</div>
                <div class="info-value code">{view.alias}</div>
              </div>
            {/if}
            {#if view.hide_metadata_if_alias_used !== undefined}
              <div class="info-item">
                <div class="info-label">Hide Metadata if Alias Used</div>
                <div class="info-value">
                  {view.hide_metadata_if_alias_used ? "Yes" : "No"}
                </div>
              </div>
            {/if}
          </div>
        </section>

        <!-- Allowed Actions -->
        <section class="info-section">
          <h2 class="section-title">
            <Shield size={20} />
            Allowed Actions ({(view as any).allowed_actions?.length || 0})
          </h2>
          {#if (view as any).allowed_actions && (view as any).allowed_actions.length > 0}
            <div class="permission-groups">
              {#each groupedActions as group}
                <div class="permission-group">
                  <div class="group-header">
                    <span class="group-label">{group.label}</span>
                    <span class="group-count">{group.actions.length}</span>
                  </div>
                  <div class="permissions-grid">
                    {#each group.actions as action}
                      <div class="permission-item" data-testid="perm-{action}">
                        <CheckCircle size={16} class="permission-icon enabled" />
                        <span class="permission-label">{action}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <p class="text-gray-600 dark:text-gray-400">No actions allowed</p>
          {/if}
        </section>

        <!-- Grant Access to Views -->
        {#if (view as any).can_grant_access_to_views && (view as any).can_grant_access_to_views.length > 0}
          <section class="info-section">
            <h2 class="section-title">
              <Shield size={20} />
              Can Grant Access to Views
            </h2>
            <div class="permissions-grid">
              {#each (view as any).can_grant_access_to_views as viewName}
                <div class="permission-item">
                  <CheckCircle size={16} class="permission-icon enabled" />
                  <span class="permission-label">{viewName}</span>
                </div>
              {/each}
            </div>
          </section>
        {/if}

        <!-- Revoke Access to Views -->
        {#if (view as any).can_revoke_access_to_views && (view as any).can_revoke_access_to_views.length > 0}
          <section class="info-section">
            <h2 class="section-title">
              <Shield size={20} />
              Can Revoke Access to Views
            </h2>
            <div class="permissions-grid">
              {#each (view as any).can_revoke_access_to_views as viewName}
                <div class="permission-item">
                  <CheckCircle size={16} class="permission-icon enabled" />
                  <span class="permission-label">{viewName}</span>
                </div>
              {/each}
            </div>
          </section>
        {/if}
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

  .status-public {
    background: #10b981;
    color: #ffffff;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .status-public {
    background: #10b981;
    color: #ffffff;
    font-weight: 600;
  }

  .status-private {
    background: #fee2e2;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .status-private {
    background: rgba(239, 68, 68, 0.2);
    color: rgb(var(--color-error-300));
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: background 0.2s;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  :global([data-mode="dark"]) .btn-primary {
    background: #3b82f6;
  }

  :global([data-mode="dark"]) .btn-primary:hover {
    background: #2563eb;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: #f3f4f6;
    color: #374151;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    white-space: nowrap;
  }

  .btn-secondary:hover {
    background: #e5e7eb;
  }

  :global([data-mode="dark"]) .btn-secondary {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .btn-secondary:hover {
    background: rgb(var(--color-surface-600));
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
  }

  :global([data-mode="dark"]) .info-value {
    color: var(--color-surface-200);
  }

  .info-value.code {
    font-family: monospace;
    background: #f3f4f6;
    padding: 0.5rem;
    border-radius: 4px;
    word-break: break-all;
  }

  :global([data-mode="dark"]) .info-value.code {
    background: rgb(var(--color-surface-900));
  }

  .permission-groups {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .permission-group {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
  }

  :global([data-mode="dark"]) .permission-group {
    border-color: rgb(var(--color-surface-700));
  }

  .group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.625rem 1rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .group-header {
    background: rgb(var(--color-surface-900));
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .group-label {
    font-size: 0.813rem;
    font-weight: 600;
    color: #374151;
  }

  :global([data-mode="dark"]) .group-label {
    color: var(--color-surface-200);
  }

  .group-count {
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .group-count {
    color: var(--color-surface-400);
  }

  .permissions-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.25rem;
    padding: 0.5rem;
  }

  .permission-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
  }


  .permission-icon {
    flex-shrink: 0;
  }

  .permission-icon.enabled {
    color: #10b981;
  }

  :global([data-mode="dark"]) .permission-icon.enabled {
    color: rgb(var(--color-success-400));
  }

  .permission-icon.disabled {
    color: #d1d5db;
  }

  :global([data-mode="dark"]) .permission-icon.disabled {
    color: var(--color-surface-600);
  }

  .permission-label {
    font-size: 0.813rem;
    color: #374151;
    font-weight: 500;
  }

  :global([data-mode="dark"]) .permission-label {
    color: var(--color-surface-300);
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
    }

    .header-left {
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
    }

    .btn-secondary {
      flex: 1;
      justify-content: center;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .permissions-grid {
      grid-template-columns: 1fr 1fr;
    }

    .header-title-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
  }
</style>
