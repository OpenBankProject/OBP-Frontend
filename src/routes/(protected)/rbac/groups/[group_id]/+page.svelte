<script lang="ts">
  import type { PageData } from "./$types";
  import {
    Users,
    Building2,
    Shield,
    ArrowLeft,
    Edit,
    Trash2,
    CheckCircle,
    XCircle,
    AlertCircle,
  } from "@lucide/svelte";

  let { data } = $props<{ data: PageData }>();

  let group = $derived(data.group);
  let entitlements = $derived(data.entitlements || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);
</script>

<svelte:head>
  <title>{group ? group.group_name : "Group"} - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb mb-6">
    <a href="/rbac/groups" class="breadcrumb-link">Groups</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">{group?.group_name || "Group Detail"}</span
    >
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
          <div class="header-left">
            <div class="header-icon">
              <Users size={32} />
            </div>
            <div>
              <div class="header-title-row">
                <h1 class="panel-title">{group.group_name}</h1>
                {#if group.is_enabled}
                  <span class="status-badge status-enabled">
                    <CheckCircle size={14} />
                    Active
                  </span>
                {:else}
                  <span class="status-badge status-disabled">
                    <XCircle size={14} />
                    Disabled
                  </span>
                {/if}
              </div>
              <div class="panel-subtitle">{group.group_description}</div>
            </div>
          </div>
          <div class="header-actions">
            <a href="/rbac/groups" class="btn-secondary">
              <ArrowLeft size={16} />
              Back to Groups
            </a>
            <a
              href="/rbac/groups/{group.group_id}/edit"
              class="btn-secondary"
              data-testid="edit-group-link"
            >
              <Edit size={16} />
              Edit
            </a>
            <a href="/rbac/groups/{group.group_id}/delete" class="btn-danger">
              <Trash2 size={16} />
              Delete
            </a>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="panel-content">
        <!-- Group Info Section -->
        <section class="info-section">
          <h2 class="section-title">Group Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Group ID</div>
              <div class="info-value">{group.group_id}</div>
            </div>
            <div class="info-item">
              <div class="info-label">
                <Building2 size={16} />
                Bank ID
              </div>
              <div class="info-value">{group.bank_id || "N/A"}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Status</div>
              <div class="info-value">
                {group.is_enabled ? "Enabled" : "Disabled"}
              </div>
            </div>
          </div>
        </section>

        <!-- Roles Section -->
        <section class="info-section">
          <h2 class="section-title">
            <Shield size={20} />
            Roles ({group.list_of_roles?.length || 0})
          </h2>
          {#if group.list_of_roles && group.list_of_roles.length > 0}
            <div class="roles-grid">
              {#each group.list_of_roles as role}
                <div class="role-card">
                  <div class="role-icon">
                    <Shield size={16} />
                  </div>
                  <span class="role-name">{role}</span>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state-small">
              <Shield size={32} />
              <p>No roles assigned to this group</p>
            </div>
          {/if}
        </section>

        <!-- Entitlements Section -->
        <section class="info-section">
          <h2 class="section-title">
            <Shield size={20} />
            Entitlements ({entitlements.length})
          </h2>
          {#if entitlements.length > 0}
            <div class="entitlements-grid">
              {#each entitlements as entitlement}
                <div class="entitlement-card">
                  <div class="entitlement-name">
                    {entitlement.role_name}
                  </div>
                  <div class="entitlement-details">
                    {#if entitlement.bank_id}
                      <span class="entitlement-detail">
                        <Building2 size={12} />
                        {entitlement.bank_id}
                      </span>
                    {/if}
                    {#if entitlement.user_id}
                      <span class="entitlement-detail">
                        User: {entitlement.username || entitlement.user_id}
                      </span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="empty-state-small">
              <AlertCircle size={32} />
              <p>No entitlements assigned to this group</p>
            </div>
          {/if}
        </section>
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

  .status-enabled {
    background: #d1fae5;
    color: #065f46;
  }

  :global([data-mode="dark"]) .status-enabled {
    background: rgba(16, 185, 129, 0.2);
    color: rgb(var(--color-success-300));
  }

  .status-disabled {
    background: #fee2e2;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .status-disabled {
    background: rgba(239, 68, 68, 0.2);
    color: rgb(var(--color-error-300));
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
    flex-shrink: 0;
  }

  .btn-secondary,
  .btn-danger {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    white-space: nowrap;
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .btn-secondary:disabled {
    opacity: 0.5;
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
    background: #fef2f2;
    color: #dc2626;
  }

  .btn-danger:hover:not(:disabled) {
    background: #fee2e2;
  }

  .btn-danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-danger {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(var(--color-error-400));
  }

  :global([data-mode="dark"]) .btn-danger:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
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
    display: flex;
    align-items: center;
    gap: 0.375rem;
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
    word-break: break-all;
  }

  :global([data-mode="dark"]) .info-value {
    color: var(--color-surface-200);
  }

  .roles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    max-width: 100%;
  }

  .role-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    transition: all 0.2s;
    min-width: 0;
  }

  .role-card:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
  }

  :global([data-mode="dark"]) .role-card {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  :global([data-mode="dark"]) .role-card:hover {
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-600));
  }

  .role-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: #eff6ff;
    color: #3b82f6;
    border-radius: 6px;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .role-icon {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-400));
  }

  .role-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #111827;
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    min-width: 0;
  }

  :global([data-mode="dark"]) .role-name {
    color: var(--color-surface-200);
  }

  .empty-state-small {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    background: #fafafa;
    border: 1px dashed #d1d5db;
    border-radius: 6px;
    color: #9ca3af;
    text-align: center;
  }

  :global([data-mode="dark"]) .empty-state-small {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
    color: var(--color-surface-500);
  }

  .empty-state-small p {
    margin: 0;
    font-size: 0.875rem;
  }

  .entitlements-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
  }

  .entitlement-card {
    padding: 0.875rem;
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .entitlement-card:hover {
    background: #f3f4f6;
    border-color: #d1d5db;
  }

  :global([data-mode="dark"]) .entitlement-card {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  :global([data-mode="dark"]) .entitlement-card:hover {
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-600));
  }

  .entitlement-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  :global([data-mode="dark"]) .entitlement-name {
    color: var(--color-surface-100);
  }

  .entitlement-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .entitlement-detail {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .entitlement-detail {
    color: var(--color-surface-400);
  }

  @media (max-width: 768px) {
    .header-content {
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
      flex-wrap: wrap;
    }

    .btn-secondary,
    .btn-danger {
      flex: 1;
      justify-content: center;
      min-width: 120px;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .roles-grid {
      grid-template-columns: 1fr;
    }

    .entitlements-grid {
      grid-template-columns: 1fr;
    }

    .header-title-row {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
