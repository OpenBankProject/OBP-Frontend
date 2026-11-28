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
  import { page } from "$app/state";
  import { Trash2 } from "@lucide/svelte";

  let { data } = $props<{ data: PageData }>();

  let roleName = $derived(data.roleName);
  let entitlements = $derived(data.entitlements || []);
  let endpoints = $derived(data.endpoints || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);
  let requiresBankId = $derived(data.requiresBankId || false);
</script>

<svelte:head>
  <title>{roleName} - RBAC Roles - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb -->
  <nav class="breadcrumb mb-6">
    <a href="/rbac/roles" class="breadcrumb-link">Roles</a>
    <span class="breadcrumb-separator">/</span>
    <span class="breadcrumb-current">{roleName}</span>
  </nav>

  <!-- Error Alert -->
  {#if error}
    <div class="alert alert-error mb-6">
      <strong>Error:</strong>
      {error}
    </div>
  {/if}

  <!-- Role Header -->
  <div class="panel mb-6">
    <div class="panel-header">
      <div class="role-header">
        <div class="role-icon-large">🛡️</div>
        <div class="role-header-info">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <h1 class="role-title">{roleName}</h1>
            {#if requiresBankId}
              <span class="requires-bank-badge">Requires Bank ID</span>
            {:else}
              <span class="system-wide-badge">System-wide</span>
            {/if}
          </div>
          <div class="role-stats">
            <span class="stat-badge">
              <span class="stat-number">{entitlements.length}</span>
              <span class="stat-label">Users</span>
            </span>
            <span class="stat-separator">•</span>
            <span class="stat-badge">
              <span class="stat-number">{endpoints.length}</span>
              <span class="stat-label">Endpoints</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  {#if !hasApiAccess}
    <div class="panel">
      <div class="panel-content">
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <h4 class="empty-title">No API Access</h4>
          <p class="empty-text">
            You need API access to view role details. Please contact your
            administrator.
          </p>
        </div>
      </div>
    </div>
  {:else}
    <div class="grid-layout">
      <!-- Endpoints Panel -->
      <div class="panel">
        <div class="panel-header">
          <div class="section-header">
            <h2 class="section-title">
              <span class="section-icon">🔗</span>
              Enabled Endpoints
            </h2>
            <span class="section-count">{endpoints.length}</span>
          </div>
        </div>
        <div class="panel-content">
          {#if endpoints.length === 0}
            <div class="empty-state-small">
              <p class="empty-text">No endpoints are enabled by this role.</p>
            </div>
          {:else}
            <div class="endpoints-list">
              {#each endpoints as endpoint}
                <div class="endpoint-card">
                  <div class="endpoint-header">
                    <span
                      class="http-method method-{endpoint.request_verb.toLowerCase()}"
                    >
                      {endpoint.request_verb}
                    </span>
                    <code class="endpoint-url">{endpoint.request_url}</code>
                  </div>
                  <div class="endpoint-body">
                    <h4 class="endpoint-title">{endpoint.summary}</h4>
                    {#if endpoint.operation_id}
                      <div class="endpoint-meta">
                        <span class="meta-label">Operation ID:</span>
                        <code class="operation-id">{endpoint.operation_id}</code
                        >
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <!-- Users Panel -->
      <div class="panel">
        <div class="panel-header">
          <div class="section-header">
            <h2 class="section-title">
              <span class="section-icon">👥</span>
              Users with this Role
            </h2>
            <span class="section-count">{entitlements.length}</span>
          </div>
        </div>
        <div class="panel-content">
          {#if entitlements.length === 0}
            <div class="empty-state-small">
              <p class="empty-text">No users have been assigned this role.</p>
            </div>
          {:else}
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Entitlement ID</th>
                    <th>Bank ID</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {#each entitlements as entitlement}
                    <tr>
                      <td class="username-cell">
                        <span class="user-icon">👤</span>
                        <a
                          href="/users/{entitlement.user_id}"
                          class="username-link"
                        >
                          {entitlement.username}
                        </a>
                      </td>
                      <td class="userid-cell">
                        <a
                          href="/rbac/entitlements/{entitlement.entitlement_id}/delete"
                          class="entitlement-link"
                        >
                          <code>{entitlement.entitlement_id}</code>
                        </a>
                      </td>
                      <td>
                        {#if entitlement.bank_id}
                          <span class="bank-badge">{entitlement.bank_id}</span>
                        {:else}
                          <span class="system-badge">System-wide</span>
                        {/if}
                      </td>
                      <td class="actions-cell">
                        <a
                          href="/rbac/entitlements/{entitlement.entitlement_id}/delete"
                          class="delete-button"
                          title="Delete entitlement"
                        >
                          <Trash2 size={16} />
                        </a>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1600px;
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
    transition: color 0.2s;
  }

  .breadcrumb-link:hover {
    color: var(--ui-link-hover);
    text-decoration: underline;
  }

  .breadcrumb-separator {
    color: var(--ui-muted);
  }

  .breadcrumb-current {
    color: var(--ui-muted);
    font-weight: 500;
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

  .panel-content {
    padding: 1.5rem;
  }

  .role-header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .role-icon-large {
    font-size: 4rem;
    flex-shrink: 0;
  }

  .role-header-info {
    flex: 1;
  }

  .role-title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--ui-text);
    margin: 0 0 0.75rem 0;
  }

  .role-stats {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .stat-badge {
    display: inline-flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .stat-number {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--ui-link);
  }

  .stat-label {
    font-size: 0.875rem;
    color: var(--ui-muted);
  }

  .stat-separator {
    color: var(--ui-muted);
  }

  .alert {
    padding: 1rem;
    border-radius: 0.375rem;
  }

  .alert-error {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
    border: 1px solid var(--ui-tone-error-border);
  }

  .grid-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .section-icon {
    font-size: 1.5rem;
  }

  .section-count {
    background: var(--ui-panel);
    color: var(--ui-muted);
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .empty-state,
  .empty-state-small {
    text-align: center;
    padding: 3rem;
    color: var(--ui-muted);
  }

  .empty-state-small {
    padding: 2rem;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-title {
    color: var(--ui-muted);
    margin-bottom: 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .empty-text {
    color: var(--ui-muted);
  }

  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--ui-border);
    border-radius: 0.5rem;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
  }

  .data-table th {
    text-align: left;
    padding: 0.75rem 1rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--ui-text);
    background: var(--ui-card);
    border-bottom: 2px solid var(--ui-border);
  }

  .data-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--ui-border);
    font-size: 0.875rem;
    color: var(--ui-text);
  }

  .data-table tbody tr:hover {
    background: var(--ui-hover);
  }

  .data-table tbody tr:last-child td {
    border-bottom: none;
  }

  .username-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
  }

  .username-link {
    color: var(--ui-link);
    text-decoration: none;
    transition: color 0.2s;
  }

  .username-link:hover {
    color: var(--ui-link-hover);
    text-decoration: underline;
  }

  .entitlement-link {
    color: var(--ui-link);
    text-decoration: none;
    transition: color 0.2s;
  }

  .entitlement-link:hover {
    color: var(--ui-link-hover);
    text-decoration: underline;
  }

  .user-icon {
    font-size: 1.125rem;
  }

  .userid-cell {
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--ui-muted);
  }

  .userid-cell code {
    background: var(--ui-panel);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
  }

  .bank-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .system-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: var(--ui-panel);
    color: var(--ui-muted);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .requires-bank-badge {
    display: inline-block;
    padding: 0.375rem 0.75rem;
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .system-wide-badge {
    display: inline-block;
    padding: 0.375rem 0.75rem;
    background: var(--ui-panel);
    color: var(--ui-muted);
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .actions-cell {
    text-align: center;
    width: 80px;
  }

  .delete-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem;
    color: var(--ui-muted);
    border-radius: 0.25rem;
    transition: all 0.2s;
    text-decoration: none;
  }

  .delete-button:hover {
    color: var(--ui-tone-error-text);
    background: var(--ui-tone-error-bg);
  }

  .endpoints-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .endpoint-card {
    border: 1px solid var(--ui-border);
    border-radius: 0.5rem;
    overflow: hidden;
    transition: all 0.2s;
  }

  .endpoint-card:hover {
    border-color: var(--ui-border);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .endpoint-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--ui-card);
    border-bottom: 1px solid var(--ui-border);
  }

  .http-method {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex-shrink: 0;
  }

  .method-get {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .method-post {
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
  }

  .method-put {
    background: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
  }

  .method-delete {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
  }

  .method-patch {
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
  }

  .endpoint-url {
    font-family: monospace;
    font-size: 0.8125rem;
    color: var(--ui-text);
    background: var(--ui-card);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid var(--ui-border);
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .endpoint-body {
    padding: 1rem;
  }

  .endpoint-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0 0 0.5rem 0;
  }

  .endpoint-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .meta-label {
    font-size: 0.75rem;
    color: var(--ui-muted);
    font-weight: 500;
  }

  .operation-id {
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--ui-tone-info-text);
    background: var(--ui-tone-info-bg);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
  }

  .endpoint-description {
    font-size: 0.875rem;
    color: var(--ui-muted);
    line-height: 1.5;
    margin: 0;
  }

  .endpoint-description :global(h1),
  .endpoint-description :global(h2),
  .endpoint-description :global(h3),
  .endpoint-description :global(h4) {
    font-weight: 600;
    margin-top: 0.75rem;
    margin-bottom: 0.5rem;
    color: var(--ui-text);
  }

  .endpoint-description :global(code) {
    background: var(--ui-panel);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.8125rem;
    font-family: monospace;
  }

  .endpoint-description :global(pre) {
    background: var(--ui-card);
    padding: 0.75rem;
    border-radius: 0.375rem;
    overflow-x: auto;
    margin: 0.5rem 0;
  }

  .endpoint-description :global(ul),
  .endpoint-description :global(ol) {
    margin: 0.5rem 0;
    padding-left: 1.5rem;
  }

  .endpoint-description :global(li) {
    margin: 0.25rem 0;
  }

  .endpoint-description :global(a) {
    color: var(--ui-link);
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    .role-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .role-stats {
      flex-wrap: wrap;
    }

    .endpoint-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .endpoint-url {
      width: 100%;
    }
  }
</style>
