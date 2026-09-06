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
    AlertTriangle,
    User,
    Building2,
    Shield,
    ArrowLeft,
  } from "@lucide/svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  let { data } = $props<{ data: PageData }>();

  let entitlement = $derived(data.entitlement);
  let user = $derived(data.user);
  let bank = $derived(data.bank);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);
  let isDeleting = $state(false);

  function formatDate(dateString: string): string {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "N/A";
    }
  }

  async function handleDelete() {
    if (!entitlement?.entitlement_id) return;

    isDeleting = true;

    try {
      const response = await trackedFetch(
        `/backend/rbac/entitlements/${entitlement.entitlement_id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      toast.success(
        "Entitlement Deleted",
        `Successfully removed ${entitlement.role_name} from ${user?.username || entitlement.user_id}`,
      );

      // Redirect to user detail page after short delay
      setTimeout(() => {
        if (entitlement.user_id) {
          goto(`/users/${entitlement.user_id}`);
        } else {
          goto("/rbac/entitlements");
        }
      }, 1000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete entitlement";
      toast.error("Error", errorMessage);
    } finally {
      isDeleting = false;
    }
  }

  function handleCancel() {
    if (entitlement?.user_id) {
      goto(`/users/${entitlement.user_id}`);
    } else {
      goto("/rbac/entitlements");
    }
  }
</script>

<svelte:head>
  <title>Delete Entitlement - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb mb-6">
    <a href="/rbac/entitlements" class="breadcrumb-link">Entitlements</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">Delete Entitlement</span>
  </nav>

  {#if error}
    <div class="alert alert-error mb-6">
      <AlertTriangle size={20} />
      <div>
        <strong>Error:</strong>
        {error}
      </div>
    </div>
    <button type="button" class="btn-secondary" onclick={handleCancel}>
      <ArrowLeft size={16} />
      Go Back
    </button>
  {:else if !hasApiAccess}
    <div class="alert alert-error mb-6">
      <AlertTriangle size={20} />
      <div>
        <strong>No API Access:</strong>
        Unable to load entitlement details. Please check your API access.
      </div>
    </div>
    <button type="button" class="btn-secondary" onclick={handleCancel}>
      <ArrowLeft size={16} />
      Go Back
    </button>
  {:else if entitlement}
    <div class="panel">
      <div class="panel-header">
        <div class="warning-icon">
          <AlertTriangle size={32} />
        </div>
        <h1 class="panel-title">Delete Entitlement</h1>
        <div class="panel-subtitle">
          Are you sure you want to delete this entitlement? This action cannot
          be undone.
        </div>
      </div>

      <div class="panel-content">
        <!-- Entitlement Details -->
        <div class="details-section">
          <h2 class="section-title">Entitlement Details</h2>
          <div class="details-grid">
            <div class="detail-item">
              <div class="detail-icon">
                <Shield size={18} />
              </div>
              <div class="detail-content">
                <div class="detail-label">Role</div>
                <div class="detail-value">{entitlement.role_name || "N/A"}</div>
              </div>
            </div>

            <div class="detail-item">
              <div class="detail-icon">
                <User size={18} />
              </div>
              <div class="detail-content">
                <div class="detail-label">User</div>
                <div class="detail-value">
                  {#if user}
                    {user.username || user.email || entitlement.user_id}
                  {:else}
                    {entitlement.user_id || "N/A"}
                  {/if}
                </div>
                {#if user && user.email && user.username !== user.email}
                  <div class="detail-extra">{user.email}</div>
                {/if}
              </div>
            </div>

            {#if entitlement.bank_id}
              <div class="detail-item">
                <div class="detail-icon">
                  <Building2 size={18} />
                </div>
                <div class="detail-content">
                  <div class="detail-label">Bank</div>
                  <div class="detail-value">
                    {#if bank}
                      {bank.short_name || bank.full_name || entitlement.bank_id}
                    {:else}
                      {entitlement.bank_id}
                    {/if}
                  </div>
                  {#if bank && bank.full_name && bank.short_name !== bank.full_name}
                    <div class="detail-extra">{bank.full_name}</div>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="detail-item">
                <div class="detail-icon">
                  <Building2 size={18} />
                </div>
                <div class="detail-content">
                  <div class="detail-label">Scope</div>
                  <div class="detail-value">
                    <span class="badge badge-system">System-wide</span>
                  </div>
                </div>
              </div>
            {/if}

            {#if entitlement.entitlement_id}
              <div class="detail-item">
                <div class="detail-content">
                  <div class="detail-label">Entitlement ID</div>
                  <div class="detail-value detail-id">
                    {entitlement.entitlement_id}
                  </div>
                </div>
              </div>
            {/if}

            {#if entitlement.created_date}
              <div class="detail-item">
                <div class="detail-content">
                  <div class="detail-label">Created Date</div>
                  <div class="detail-value">
                    {formatDate(entitlement.created_date)}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        </div>

        <!-- Warning Box -->
        <div class="warning-box">
          <AlertTriangle size={20} />
          <div>
            <div class="warning-title">Warning</div>
            <div class="warning-text">
              Deleting this entitlement will immediately revoke the user's
              access to this role.
              {#if user}
                <strong>{user.username || user.email}</strong>
              {:else}
                The user
              {/if}
              will no longer be able to perform actions associated with
              <strong>{entitlement.role_name}</strong>.
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="action-buttons">
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
              <AlertTriangle size={16} />
              Delete Entitlement
            {/if}
          </button>
        </div>
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <p>Entitlement not found</p>
      <button type="button" class="btn-secondary" onclick={handleCancel}>
        <ArrowLeft size={16} />
        Go Back
      </button>
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
    text-align: center;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .warning-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background: #fef3c7;
    color: #f59e0b;
    border-radius: 50%;
    margin: 0 auto 1rem;
  }

  :global([data-mode="dark"]) .warning-icon {
    background: rgba(245, 158, 11, 0.2);
    color: rgb(var(--color-warning-400));
  }

  .panel-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .panel-content {
    padding: 2rem;
  }

  .details-section {
    margin-bottom: 2rem;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 1rem;
  }

  :global([data-mode="dark"]) .section-title {
    color: var(--color-surface-100);
  }

  .details-grid {
    display: grid;
    gap: 1.5rem;
  }

  .detail-item {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .detail-item {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
  }

  .detail-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: white;
    color: #6b7280;
    border-radius: 6px;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .detail-icon {
    background: rgb(var(--color-surface-600));
    color: var(--color-surface-300);
  }

  .detail-content {
    flex: 1;
    min-width: 0;
  }

  .detail-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: #6b7280;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
  }

  :global([data-mode="dark"]) .detail-label {
    color: var(--color-surface-400);
  }

  .detail-value {
    font-size: 0.875rem;
    color: #111827;
    font-weight: 500;
    word-break: break-word;
  }

  :global([data-mode="dark"]) .detail-value {
    color: var(--color-surface-100);
  }

  .detail-id {
    font-family: monospace;
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .detail-id {
    color: var(--color-surface-400);
  }

  .detail-extra {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .detail-extra {
    color: var(--color-surface-400);
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .badge-system {
    background: #dbeafe;
    color: #1e40af;
  }

  :global([data-mode="dark"]) .badge-system {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-300));
  }

  .warning-box {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: #f4ecda;
    border: 1px solid #e7b622;
    border-radius: 6px;
    margin-bottom: 2rem;
    color: #e7b622;
  }

  :global([data-mode="dark"]) .warning-box {
    background: #2e261e;
    border-color: #f3c63f;
    color: #f3c63f;
  }

  .warning-box :global(svg) {
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .warning-title {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .warning-text {
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .action-buttons {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
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
    background: #f3f4f6;
    color: #374151;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .btn-secondary:disabled {
    opacity: 0.6;
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
    background: #dc2626;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #b91c1c;
  }

  .btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-danger {
    background: rgb(var(--color-error-600));
  }

  :global([data-mode="dark"]) .btn-danger:hover:not(:disabled) {
    background: rgb(var(--color-error-700));
  }

  .alert {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    border-radius: 0.375rem;
  }

  .alert-error {
    background: #2f131f;
    color: #f7dde0;
    border: 1px solid #f7dde0;
  }

  :global([data-mode="dark"]) .alert-error {
    background: #2f131f;
    color: #ff4e4e;
    border-color: #ff4e4e;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
  }

  @media (max-width: 640px) {
    .action-buttons {
      flex-direction: column-reverse;
    }

    .btn-secondary,
    .btn-danger {
      width: 100%;
      justify-content: center;
    }
  }
</style>
