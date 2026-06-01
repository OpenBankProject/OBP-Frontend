<script lang="ts">
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";
  import { Search } from "@lucide/svelte";

  let { data } = $props<{ data: PageData }>();

  let views = $derived(data.views || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  // Search functionality
  let searchQuery = $state("");

  let filteredViews = $derived.by(() => {
    if (!searchQuery.trim()) {
      return views;
    }
    const query = searchQuery.toLowerCase();
    return views.filter(
      (view: any) =>
        view.short_name.toLowerCase().includes(query) ||
        view.description.toLowerCase().includes(query) ||
        view.view_id.toLowerCase().includes(query),
    );
  });

  function handleCreateView() {
    goto("/account-access/system-views/create");
  }
</script>

<svelte:head>
  <title>System Views - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div>
          <h1 class="panel-title">System Views</h1>
          <div class="panel-subtitle">
            System-defined views that control account data visibility
            ({views.length} total, {views.filter((v: any) => v.is_public).length} public)
          </div>
        </div>
        <div class="header-controls">
          <button
            onclick={handleCreateView}
            data-testid="create-system-view-btn"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Create System View
          </button>
        </div>
      </div>
    </div>

    <div class="panel-content">
      {#if error}
        <div class="error-message">
          <p>{error}</p>
        </div>
      {/if}

      {#if views.length === 0}
        <div class="empty-state">
          <h4 class="empty-title">No Views Found</h4>
          <p class="empty-description">
            No views available. You may need to create views or have specific permissions.
          </p>
        </div>
      {:else}
        <!-- Search Bar -->
        <div class="search-bar">
          <Search class="search-icon" size={16} />
          <input
            type="text"
            class="search-input"
            name="search-views"
            data-testid="search-views"
            placeholder="Search views..."
            bind:value={searchQuery}
          />
          {#if searchQuery}
            <span class="search-count">{filteredViews.length} of {views.length}</span>
          {/if}
        </div>

        <!-- Views Table -->
        {#if filteredViews.length === 0}
          <p class="no-results">No views match your search.</p>
        {:else}
          <table class="views-table" data-testid="system-views-table">
            <thead>
              <tr>
                <th>View ID</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredViews as view}
                <tr data-testid="view-row-{view.view_id}">
                  <td class="cell-mono">
                    <a href="/account-access/system-views/{view.view_id}" class="view-link" data-testid="view-link-{view.view_id}">
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
    padding: 1rem 1.5rem;
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
    font-size: 0.813rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .panel-content {
    padding: 1rem 1.5rem;
  }

  .error-message {
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
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
    padding: 2rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
  }

  .empty-title {
    font-size: 1rem;
    font-weight: 600;
    color: #4a5568;
    margin: 0 0 0.5rem 0;
  }

  :global([data-mode="dark"]) .empty-title {
    color: var(--color-surface-300);
  }

  .empty-description {
    margin: 0;
    color: #6b7280;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .empty-description {
    color: var(--color-surface-400);
  }

  .search-bar {
    position: relative;
    margin-bottom: 1rem;
  }

  .search-bar :global(.search-icon) {
    position: absolute;
    left: 0.75rem;
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
    padding: 0.5rem 0.75rem 0.5rem 2.25rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.813rem;
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

  .search-count {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.75rem;
    color: #9ca3af;
  }

  :global([data-mode="dark"]) .search-count {
    color: var(--color-surface-400);
  }

  .no-results {
    text-align: center;
    color: #6b7280;
    font-size: 0.875rem;
    padding: 1rem 0;
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

  .cell-description {
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .cell-center {
    text-align: center;
  }

  :global(.icon-public) {
    color: #10b981;
  }

  :global([data-mode="dark"]) :global(.icon-public) {
    color: #34d399;
  }

  .text-muted {
    color: #d1d5db;
  }

  :global([data-mode="dark"]) .text-muted {
    color: var(--color-surface-600);
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .views-table {
      display: block;
      overflow-x: auto;
    }

    .cell-description {
      max-width: 200px;
    }
  }
</style>
