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
        hourCycle: "h23",
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
        <div class="text-sm mt-1 ui-muted">
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
                <a href="/users/{encodeURIComponent(data.provider)}/{encodeURIComponent(data.username)}/unlock" class="action-link action-link-success">Unlock User</a>
              {:else}
                <span class="badge badge-success">No</span>
                <a href="/users/{encodeURIComponent(data.provider)}/{encodeURIComponent(data.username)}/lock" class="action-link action-link-error">Lock User</a>
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
    padding: 1.5rem;
    border-bottom: 1px solid var(--ui-border);
  }

  .panel-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ui-text);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: var(--ui-muted);
    margin-top: 0.25rem;
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
    color: var(--ui-muted);
    letter-spacing: 0.05em;
  }

  .info-value {
    font-size: 0.875rem;
    color: var(--ui-text);
  }

  .entitlements-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1rem;
  }

  .entitlement-card {
    padding: 1rem;
    background: var(--ui-card);
    border: 1px solid var(--ui-border);
    border-radius: 0.5rem;
  }

  .entitlement-name {
    font-weight: 600;
    color: var(--ui-text);
    margin-bottom: 0.5rem;
  }

  .entitlement-detail {
    font-size: 0.875rem;
    color: var(--ui-muted);
    margin-top: 0.25rem;
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
    color: var(--ui-text);
    border-bottom: 2px solid var(--ui-border);
  }

  .accounts-table td,
  .views-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--ui-border);
    font-size: 0.875rem;
  }

  .accounts-table tbody tr:hover,
  .views-table tbody tr:hover {
    background: var(--ui-hover);
  }

  .badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .badge-success {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .badge-default {
    background: var(--ui-panel);
    color: var(--ui-text);
  }

  .badge-error {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
  }

  .action-link {
    margin-left: 0.5rem;
    font-size: 0.75rem;
    color: var(--ui-link);
    text-decoration: none;
  }

  .action-link:hover {
    text-decoration: underline;
  }

  .action-link-success {
    color: var(--ui-success);
  }

  .action-link-error {
    color: var(--ui-error);
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--ui-muted);
  }

  .empty-state-inline {
    text-align: center;
    padding: 1.5rem;
    color: var(--ui-muted);
    font-size: 0.875rem;
  }

  .empty-state-inline code {
    background: var(--ui-panel);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.8125rem;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1rem;
  }

  .alert-error {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
    border: 1px solid var(--ui-tone-error-border);
  }

  .alert-success {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
    border: 1px solid var(--ui-tone-success-border);
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
    background: var(--ui-panel);
    color: var(--ui-text);
    border: 1px solid var(--ui-border);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--ui-hover);
  }

  .btn-success {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .btn-success:hover:not(:disabled) {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .btn-danger {
    background: var(--ui-fill-danger-bg);
    color: var(--ui-fill-danger-text);
  }

  .btn-danger:hover:not(:disabled) {
    opacity: 0.85;
  }
</style>
