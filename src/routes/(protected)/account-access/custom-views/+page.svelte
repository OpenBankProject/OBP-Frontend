<script lang="ts">
  import type { PageData } from "./$types";
  import {
    Eye,
    Search,
    Shield,
    CheckCircle,
    XCircle,
    Plus,
  } from "@lucide/svelte";

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
        view.short_name?.toLowerCase().includes(query) ||
        view.description?.toLowerCase().includes(query) ||
        view.view_id?.toLowerCase().includes(query),
    );
  });
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
            placeholder="Search views by name, description, or ID..."
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
            <div class="stat-label">Public Views</div>
            <div class="stat-value">
              {views.filter((v: any) => v.is_public).length}
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-label">Showing</div>
            <div class="stat-value">{filteredViews.length}</div>
          </div>
        </div>

        <!-- Views Grid -->
        {#if filteredViews.length === 0}
          <div class="empty-state">
            <div class="empty-icon">
              <Search size={48} />
            </div>
            <h4 class="empty-title">No views found</h4>
            <p class="empty-description">Try adjusting your search query</p>
          </div>
        {:else}
          <div class="views-grid">
            {#each filteredViews as view}
              <a
                href="/account-access/custom-views/{view.bank_id}/{view.account_id}/{view.view_id}"
                class="view-card"
              >
                <div class="view-card-header">
                  <div class="view-icon">
                    <Eye size={24} />
                  </div>
                  <div class="view-status">
                    {#if view.is_public}
                      <span class="status-badge status-public">
                        <CheckCircle size={14} />
                        Public
                      </span>
                    {:else}
                      <span class="status-badge status-private">
                        <XCircle size={14} />
                        Private
                      </span>
                    {/if}
                  </div>
                </div>
                <div class="view-card-body">
                  <h3 class="view-name">{view.short_name}</h3>
                  <p class="view-description">{view.description}</p>
                  {#if view.alias}
                    <div class="view-alias">
                      <span class="alias-label">Alias:</span>
                      <span class="alias-value">{view.alias}</span>
                    </div>
                  {/if}
                </div>
                <div class="view-card-footer">
                  <div class="view-meta">
                    <div class="meta-item">
                      <Shield size={14} />
                      <span>ID: {view.id}</span>
                    </div>
                  </div>
                </div>
              </a>
            {/each}
          </div>
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

  .views-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .view-card {
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    transition: all 0.2s;
    text-decoration: none;
    color: inherit;
  }

  .view-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
    border-color: #3b82f6;
  }

  :global([data-mode="dark"]) .view-card {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  :global([data-mode="dark"]) .view-card:hover {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .view-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }

  .view-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: #eff6ff;
    color: #3b82f6;
    border-radius: 8px;
  }

  :global([data-mode="dark"]) .view-icon {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-400));
  }

  .view-status {
    flex-shrink: 0;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .status-public {
    background: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"]) .status-public {
    background: rgba(16, 185, 129, 0.2);
    color: rgb(var(--color-success-300));
  }

  .status-private {
    background: #fee2e2;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .status-private {
    background: rgba(239, 68, 68, 0.2);
    color: rgb(var(--color-error-300));
  }

  .view-card-body {
    flex: 1;
    margin-bottom: 1rem;
  }

  .view-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0 0 0.5rem 0;
  }

  :global([data-mode="dark"]) .view-name {
    color: var(--color-surface-100);
  }

  .view-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 0.75rem 0;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  :global([data-mode="dark"]) .view-description {
    color: var(--color-surface-400);
  }

  .view-alias {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    padding: 0.5rem;
    background: #f3f4f6;
    border-radius: 4px;
  }

  :global([data-mode="dark"]) .view-alias {
    background: rgb(var(--color-surface-800));
  }

  .alias-label {
    color: #6b7280;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .alias-label {
    color: var(--color-surface-400);
  }

  .alias-value {
    color: #111827;
    font-weight: 500;
    font-family: monospace;
  }

  :global([data-mode="dark"]) .alias-value {
    color: var(--color-surface-200);
  }

  .view-card-footer {
    border-top: 1px solid #e5e7eb;
    padding-top: 1rem;
  }

  :global([data-mode="dark"]) .view-card-footer {
    border-top-color: rgb(var(--color-surface-700));
  }

  .view-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .meta-item {
    color: var(--color-surface-400);
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
      align-items: flex-start;
    }

    .views-grid {
      grid-template-columns: 1fr;
    }

    .stats {
      grid-template-columns: 1fr;
    }
  }
</style>
