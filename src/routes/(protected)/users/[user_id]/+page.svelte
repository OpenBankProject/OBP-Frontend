<script lang="ts">
  import type { PageData } from "./$types";
  import { Trash2 } from "@lucide/svelte";

  import { pageDataSummary } from "$lib/stores/pageDataSummary.svelte";
  import { pageHeading } from "$lib/stores/pageHeading.svelte";

  let { data } = $props<{ data: PageData }>();

  let user = $derived(data.user);
  let hasApiAccess = $derived(data.hasApiAccess);
  let pageError = $derived(data.error);

  $effect(() => {
    if (user) {
      const entitlements = user.entitlements?.length || 0;
      pageDataSummary.set(`Viewing user ${user.username || user.email} (${user.provider}), ${entitlements} entitlements`);
      pageHeading.set(user.username || user.email);
    }
  });

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
</script>

<svelte:head>
  <title>User Details - {user?.username || data.user_id} - API Manager II</title
  >
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb mb-6">
    <a href="/users" class="breadcrumb-link">Users</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">{user?.username || data.user_id}</span>
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
        <h1 class="text-2xl font-bold">{user.username || "Unknown User"}</h1>
        <div class="text-sm text-gray-500 mt-1">
          {user.provider || "Unknown"} Provider
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
                {#if user.provider && user.username}
                  <a href="/users/{encodeURIComponent(user.provider)}/{encodeURIComponent(user.username)}/unlock" class="action-link" style="color: #059669;">Unlock User</a>
                {/if}
              {:else}
                <span class="badge badge-success">No</span>
                {#if user.provider && user.username}
                  <a href="/users/{encodeURIComponent(user.provider)}/{encodeURIComponent(user.username)}/lock" class="action-link" style="color: #dc2626;">Lock User</a>
                {/if}
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
          {#if user.last_activity_date}
            <div class="info-item">
              <div class="info-label">Last Activity</div>
              <div class="info-value">
                {formatDate(user.last_activity_date)}
              </div>
            </div>
          {/if}
          {#if user.recent_operation_ids && user.recent_operation_ids.length > 0}
            <div class="info-item">
              <div class="info-label">Recent Operations</div>
              <div class="info-value">
                <div class="operations-compact">
                  {#each user.recent_operation_ids.slice(0, 3) as operationId}
                    <div class="operation-id-compact font-mono">
                      {operationId}
                    </div>
                  {/each}
                  {#if user.recent_operation_ids.length > 3}
                    <div class="text-xs text-gray-500 mt-1">
                      +{user.recent_operation_ids.length - 3} more
                    </div>
                  {/if}
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Entitlements Panel -->
    <div class="panel mb-6">
      <div class="panel-header">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="panel-title">Entitlements</h2>
            <div class="panel-subtitle">
              Roles and permissions assigned to this user
            </div>
          </div>
          <a
            href="/rbac/entitlements/create?username={encodeURIComponent(
              user.username || '',
            )}"
            class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create Entitlement
          </a>
        </div>
      </div>
      <div class="panel-content">
        {#if user.entitlements?.list && user.entitlements.list.length > 0}
          <div class="entitlements-grid">
            {#each user.entitlements.list as entitlement}
              <div class="entitlement-card">
                <div class="entitlement-header">
                  <div class="entitlement-name">
                    {entitlement.role_name ||
                      entitlement.entitlement_id ||
                      "Unknown"}
                  </div>
                  <a
                    href="/rbac/entitlements/{entitlement.entitlement_id}/delete"
                    class="delete-button"
                    title="Delete entitlement"
                  >
                    <Trash2 size={16} />
                  </a>
                </div>
                <div class="entitlement-detail">
                  <span class="detail-label">Scope:</span>
                  {#if entitlement.bank_id}
                    {entitlement.bank_id}
                  {:else}
                    <span class="system-wide-badge">System-wide</span>
                  {/if}
                </div>
                {#if entitlement.entitlement_request_process}
                  <div class="entitlement-detail">
                    <span class="detail-label">Process:</span>
                    {entitlement.entitlement_request_process}
                  </div>
                {/if}
                {#if entitlement.group_id}
                  <div class="entitlement-detail">
                    <span class="detail-label">Group:</span>
                    <span class="group-badge">{entitlement.group_id}</span>
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
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  @media (max-width: 768px) {
    .entitlements-grid {
      grid-template-columns: 1fr;
    }
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

  .entitlement-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .entitlement-name {
    font-weight: 600;
    color: #111827;
    word-break: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
  }

  :global([data-mode="dark"]) .entitlement-name {
    color: var(--color-surface-100);
  }

  .delete-button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    color: #6b7280;
    border-radius: 0.25rem;
    transition: all 0.2s;
    text-decoration: none;
  }

  .delete-button:hover {
    color: #dc2626;
    background: #fee2e2;
  }

  :global([data-mode="dark"]) .delete-button {
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .delete-button:hover {
    color: rgb(var(--color-error-400));
    background: rgb(var(--color-error-900));
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

  .operations-compact {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .operation-id-compact {
    font-size: 0.75rem;
    color: #374151;
    padding: 0.25rem 0.5rem;
    background: #f3f4f6;
    border-radius: 0.25rem;
  }

  :global([data-mode="dark"]) .operation-id-compact {
    color: var(--color-surface-200);
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


  .system-wide-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: #f3f4f6;
    color: #6b7280;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  :global([data-mode="dark"]) .system-wide-badge {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-300);
  }

  .group-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: #dcfce7;
    color: #166534;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  :global([data-mode="dark"]) .group-badge {
    background: rgba(34, 197, 94, 0.2);
    color: rgb(var(--color-success-300));
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
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
