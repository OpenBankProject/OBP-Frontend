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

  let { data } = $props<{ data: PageData }>();

  let user = $derived(data.user);
  let hasApiAccess = $derived(data.hasApiAccess);
  let pageError = $derived(data.error);

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
      });
    } catch {
      return "N/A";
    }
  }
</script>

<svelte:head>
  <title>User Details - {data.username} - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb mb-6">
    <a href="/users" class="breadcrumb-link">Users</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">{data.username}</span>
  </nav>

  <!-- Error Alert -->
  {#if pageError}
    <div class="alert alert-error mb-6">
      <strong>Error:</strong>
      {pageError}
    </div>
  {/if}

  {#if user}
    <!-- User Info Panel -->
    <div class="panel mb-6">
      <div class="panel-header">
        <h1 class="text-2xl font-bold">{user.username}</h1>
        <div class="text-sm text-gray-500 mt-1">
          {data.provider} Provider
        </div>
      </div>
      <div class="panel-content">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">User ID</div>
            <div class="info-value font-mono">{user.user_id || "N/A"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Email</div>
            <div class="info-value">{user.email || "N/A"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Username</div>
            <div class="info-value">{user.username || "N/A"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Provider</div>
            <div class="info-value">{user.provider || "N/A"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Created Date</div>
            <div class="info-value">{formatDate(user.created_date)}</div>
          </div>
          {#if user.last_login_date}
            <div class="info-item">
              <div class="info-label">Last Login</div>
              <div class="info-value">{formatDate(user.last_login_date)}</div>
            </div>
          {/if}
          <div class="info-item">
            <div class="info-label">Is Locked</div>
            <div class="info-value">
              {#if user.is_locked}
                <span class="badge badge-error">Yes</span>
                <a href="/users/{encodeURIComponent(data.provider)}/{encodeURIComponent(data.username)}/unlock" class="action-link" style="color: #059669;">Unlock User</a>
              {:else}
                <span class="badge badge-success">No</span>
                <a href="/users/{encodeURIComponent(data.provider)}/{encodeURIComponent(data.username)}/lock" class="action-link" style="color: #dc2626;">Lock User</a>
              {/if}
            </div>
          </div>
          <div class="info-item">
            <div class="info-label">Is Deleted</div>
            <div class="info-value">
              {#if user.is_deleted}
                <span class="badge badge-error">Yes</span>
              {:else}
                <span class="badge badge-success">No</span>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Entitlements Panel -->
    <div class="panel mb-6">
      <div class="panel-header">
        <h2 class="panel-title">Entitlements</h2>
        <div class="panel-subtitle">
          Roles and permissions assigned to this user
        </div>
      </div>
      <div class="panel-content">
        {#if user.entitlements?.list && user.entitlements.list.length > 0}
          <div class="entitlements-grid">
            {#each user.entitlements.list as entitlement}
              <div class="entitlement-card">
                <div class="entitlement-name">
                  {entitlement.role_name ||
                    entitlement.entitlement_id ||
                    "Unknown"}
                </div>
                {#if entitlement.bank_id}
                  <div class="entitlement-detail">
                    <span class="detail-label">Bank:</span>
                    {entitlement.bank_id}
                  </div>
                {/if}
                {#if entitlement.created_date}
                  <div class="entitlement-detail">
                    <span class="detail-label">Added:</span>
                    {formatDate(entitlement.created_date)}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <div class="empty-state">
            <p>No entitlements assigned to this user</p>
          </div>
        {/if}
      </div>
    </div>

    <!-- Account Access Panel -->
    {#if user.accounts && user.accounts.length > 0}
      <div class="panel mb-6">
        <div class="panel-header">
          <h2 class="panel-title">Account Access</h2>
          <div class="panel-subtitle">Accounts this user has access to</div>
        </div>
        <div class="panel-content">
          <div class="table-wrapper">
            <table class="accounts-table">
              <thead>
                <tr>
                  <th>Account ID</th>
                  <th>Bank</th>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Currency</th>
                </tr>
              </thead>
              <tbody>
                {#each user.accounts as account}
                  <tr>
                    <td class="font-mono text-sm">{account.id || "N/A"}</td>
                    <td>{account.bank_id || "N/A"}</td>
                    <td>{account.label || "N/A"}</td>
                    <td>{account.account_type || "N/A"}</td>
                    <td>{account.currency || "N/A"}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}

    <!-- Views Panel -->
    {#if user.views && user.views.length > 0}
      <div class="panel">
        <div class="panel-header">
          <h2 class="panel-title">Views</h2>
          <div class="panel-subtitle">
            Account views this user has access to
          </div>
        </div>
        <div class="panel-content">
          <div class="table-wrapper">
            <table class="views-table">
              <thead>
                <tr>
                  <th>View ID</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Is Public</th>
                </tr>
              </thead>
              <tbody>
                {#each user.views as view}
                  <tr>
                    <td class="font-mono text-sm">{view.id || "N/A"}</td>
                    <td>{view.name || view.short_name || "N/A"}</td>
                    <td>{view.description || "N/A"}</td>
                    <td>
                      {#if view.is_public}
                        <span class="badge badge-success">Yes</span>
                      {:else}
                        <span class="badge badge-default">No</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}
  {:else if !hasApiAccess}
    <div class="empty-state">
      <p>Unable to load user details. Please check your API access.</p>
    </div>
  {:else}
    <div class="empty-state">
      <p>User not found</p>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1400px;
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

  .breadcrumb-separator {
    color: #9ca3af;
  }

  .breadcrumb-current {
    color: #6b7280;
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

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .panel-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .panel-content {
    padding: 1.5rem;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: #6b7280;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .info-label {
    color: var(--color-surface-400);
  }

  .info-value {
    font-size: 0.875rem;
    color: #111827;
  }

  :global([data-mode="dark"]) .info-value {
    color: var(--color-surface-100);
  }

  .entitlements-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1rem;
  }

  .entitlement-card {
    padding: 1rem;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
  }

  :global([data-mode="dark"]) .entitlement-card {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
  }

  .entitlement-name {
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  :global([data-mode="dark"]) .entitlement-name {
    color: var(--color-surface-100);
  }

  .entitlement-detail {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .entitlement-detail {
    color: var(--color-surface-400);
  }

  .detail-label {
    font-weight: 500;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .accounts-table,
  .views-table {
    width: 100%;
    border-collapse: collapse;
  }

  .accounts-table th,
  .views-table th {
    text-align: left;
    padding: 0.75rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
    border-bottom: 2px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .accounts-table th,
  :global([data-mode="dark"]) .views-table th {
    color: var(--color-surface-300);
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .accounts-table td,
  .views-table td {
    padding: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .accounts-table td,
  :global([data-mode="dark"]) .views-table td {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .accounts-table tbody tr:hover,
  .views-table tbody tr:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .accounts-table tbody tr:hover,
  :global([data-mode="dark"]) .views-table tbody tr:hover {
    background: rgb(var(--color-surface-700));
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
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
    background: #f3f4f6;
    color: #374151;
  }

  :global([data-mode="dark"]) .badge-default {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-300);
  }

  .badge-error {
    background: #fee2e2;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .badge-error {
    background: rgb(var(--color-error-900));
    color: rgb(var(--color-error-200));
  }

  .action-link {
    margin-left: 0.5rem;
    font-size: 0.75rem;
    color: #3b82f6;
    text-decoration: none;
  }

  .action-link:hover {
    text-decoration: underline;
  }


  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  .empty-state-inline {
    text-align: center;
    padding: 1.5rem;
    color: #6b7280;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .empty-state-inline {
    color: var(--color-surface-400);
  }

  .empty-state-inline code {
    background: #f3f4f6;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.8125rem;
  }

  :global([data-mode="dark"]) .empty-state-inline code {
    background: rgb(var(--color-surface-700));
  }

  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
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

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }

  :global([data-mode="dark"]) .btn-secondary {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
    border-color: rgb(var(--color-surface-600));
  }

  :global([data-mode="dark"]) .btn-secondary:hover:not(:disabled) {
    background: rgb(var(--color-surface-600));
  }

  .btn-success {
    background: #059669;
    color: white;
  }

  .btn-success:hover:not(:disabled) {
    background: #047857;
  }

  .btn-danger {
    background: #dc2626;
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #b91c1c;
  }
</style>
