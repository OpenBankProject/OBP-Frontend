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
  import { Eye, Search, Plus } from "@lucide/svelte";

  let { data } = $props<{ data: PageData }>();

  let views = $derived(data.views || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  // Search functionality
  let searchQuery = $state("");

  let filteredViews = $derived.by(() => {
    const matched = !searchQuery.trim()
      ? views
      : (() => {
          const query = searchQuery.toLowerCase();
          return views.filter(
            (view: any) =>
              view.bank_id?.toLowerCase().includes(query) ||
              view.account_id?.toLowerCase().includes(query) ||
              view.view_id?.toLowerCase().includes(query),
          );
        })();
    return [...matched].sort((a: any, b: any) => {
      const cmp = (a.bank_id || "").localeCompare(b.bank_id || "");
      if (cmp !== 0) return cmp;
      const acc = (a.account_id || "").localeCompare(b.account_id || "");
      if (acc !== 0) return acc;
      return (a.view_id || "").localeCompare(b.view_id || "");
    });
  });

  // Palette cycles through a fixed set of distinct hues. Bank ids encountered
  // in sorted order get assigned palette[0], palette[1], ... (wrapping).
  const bankPalette = [
    "#3b82f6", // blue
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ec4899", // pink
    "#8b5cf6", // violet
    "#14b8a6", // teal
    "#ef4444", // red
    "#6366f1", // indigo
    "#f97316", // orange
    "#22c55e", // green
  ];

  const bankColors = $derived.by(() => {
    const map = new Map<string, string>();
    let i = 0;
    for (const v of filteredViews) {
      const id = v.bank_id || "";
      if (!map.has(id)) {
        map.set(id, bankPalette[i % bankPalette.length]);
        i += 1;
      }
    }
    return map;
  });

  function bankColor(bankId: string | undefined): string {
    return bankColors.get(bankId || "") || "#9ca3af";
  }
</script>

<svelte:head>
  <title>Custom Views - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div>
          <h1 class="panel-title">Custom Views</h1>
          <div class="panel-subtitle">
            Custom views created for specific account access control
          </div>
        </div>
        <div class="header-actions">
          <a href="/account-access/custom-views/create" class="btn-create">
            <Plus size={18} />
            Create View
          </a>
        </div>
      </div>
    </div>

    <div class="panel-content">
      {#if error}
        <div class="error-message">
          <p>⚠️ {error}</p>
        </div>
      {/if}

      {#if views.length === 0}
        <div class="empty-state">
          <div class="empty-icon">
            <Eye size={48} />
          </div>
          <h4 class="empty-title">No Custom Views Found</h4>
          <p class="empty-description">
            There are currently no custom views available. Custom views may need
            to be created first or you may need specific permissions to see
            them.
          </p>
          <div class="debug-info">
            <p><strong>API Access:</strong> {hasApiAccess ? "Yes" : "No"}</p>
            <p><strong>Views Count:</strong> {views.length}</p>
            <p><strong>Error:</strong> {error || "None"}</p>
          </div>
        </div>
      {:else}
        <!-- Search Bar -->
        <div class="search-bar">
          <Search class="search-icon" size={18} />
          <input
            type="text"
            class="search-input"
            placeholder="Search by bank_id, account_id, or view_id..."
            bind:value={searchQuery}
          />
        </div>

        <!-- Stats -->
        <div class="stats">
          <div class="stat-item">
            <div class="stat-label">Total Views</div>
            <div class="stat-value">{views.length}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Showing</div>
            <div class="stat-value">{filteredViews.length}</div>
          </div>
        </div>

        <!-- Views Table -->
        {#if filteredViews.length === 0}
          <div class="empty-state">
            <div class="empty-icon">
              <Search size={48} />
            </div>
            <h4 class="empty-title">No views found</h4>
            <p class="empty-description">Try adjusting your search query</p>
          </div>
        {:else}
          <table class="views-table" data-testid="custom-views-table">
            <thead>
              <tr>
                <th>Bank ID</th>
                <th>Account ID</th>
                <th>View ID</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredViews as view}
                <tr
                  data-testid="view-row-{view.view_id}"
                  data-bank-id={view.bank_id}
                >
                  <td
                    class="cell-mono cell-bank"
                    style="border-left: 4px solid {bankColor(view.bank_id)}; color: {bankColor(view.bank_id)};"
                  >{view.bank_id}</td>
                  <td class="cell-mono">{view.account_id}</td>
                  <td class="cell-mono">
                    <a
                      href="/account-access/custom-views/{view.bank_id}/{view.account_id}/{view.view_id}"
                      class="view-link"
                      data-testid="view-link-{view.view_id}"
                    >
                      {view.view_id}
                    </a>
                  </td>
                  <td class="cell-description">{view.description}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1400px;
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

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .panel-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.5rem;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-create {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .btn-create:hover {
    background: #2563eb;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .btn-create:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  :global([data-mode="dark"]) .btn-create {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-create:hover {
    background: rgb(var(--color-primary-500));
  }

  .panel-content {
    padding: 2rem;
  }

  .error-message {
    margin-bottom: 1.5rem;
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

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
  }

  .empty-icon {
    display: flex;
    justify-content: center;
    margin-bottom: 1rem;
    color: #d1d5db;
  }

  :global([data-mode="dark"]) .empty-icon {
    color: var(--color-surface-600);
  }

  .empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #4a5568;
    margin: 0 0 0.5rem 0;
  }

  :global([data-mode="dark"]) .empty-title {
    color: var(--color-surface-300);
  }

  .empty-description {
    margin: 0 0 1.5rem 0;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-description {
    color: var(--color-surface-400);
  }

  .debug-info {
    margin-top: 1rem;
    padding: 1rem;
    background: #f3f4f6;
    border-radius: 6px;
    font-size: 0.75rem;
    text-align: left;
  }

  :global([data-mode="dark"]) .debug-info {
    background: rgb(var(--color-surface-800));
  }

  .debug-info p {
    margin: 0.25rem 0;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .debug-info p {
    color: var(--color-surface-400);
  }

  .search-bar {
    position: relative;
    margin-bottom: 1rem;
  }

  .search-bar :global(.search-icon) {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    pointer-events: none;
  }

  :global([data-mode="dark"]) .search-bar :global(.search-icon) {
    color: var(--color-surface-400);
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 3rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  :global([data-mode="dark"]) .search-input {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .search-input:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-item {
    padding: 1rem;
    background: #f9fafb;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .stat-item {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  .stat-label {
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .stat-label {
    color: var(--color-surface-400);
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
  }

  :global([data-mode="dark"]) .stat-value {
    color: var(--color-surface-100);
  }

  .views-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.813rem;
  }

  .views-table thead {
    border-bottom: 2px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .views-table thead {
    border-bottom-color: rgb(var(--color-surface-600));
  }

  .views-table th {
    text-align: left;
    padding: 0.5rem 0.75rem;
    font-weight: 600;
    color: #6b7280;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .views-table th {
    color: var(--color-surface-400);
  }

  .views-table td {
    padding: 0.5rem 0.75rem;
    color: #374151;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: top;
  }

  :global([data-mode="dark"]) .views-table td {
    color: var(--color-surface-200);
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .views-table tbody tr:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .views-table tbody tr:hover {
    background: rgb(var(--color-surface-900));
  }

  .view-link {
    color: #2563eb;
    text-decoration: none;
    font-weight: 500;
    white-space: nowrap;
  }

  .view-link:hover {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .view-link {
    color: rgb(var(--color-primary-400));
  }

  .cell-mono {
    font-family: monospace;
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .cell-bank {
    padding-left: 0.5rem;
    font-weight: 600;
  }

  .cell-description {
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .stats {
      grid-template-columns: 1fr;
    }
  }
</style>
