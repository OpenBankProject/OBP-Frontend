<script lang="ts">
  import { page } from "$app/state";
  import { FileSignature, ArrowLeft, Loader2, Plus } from "@lucide/svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import { pageDataSummary } from "$lib/stores/pageDataSummary.svelte";

  let bankId = $derived(page.params.bank_id || "");
  let accountId = $derived(page.params.account_id || "");

  let mandates = $state<any[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);

  function formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  }

  function statusClass(status: string): string {
    switch (status.toUpperCase()) {
      case "ACTIVE":
        return "badge-active";
      case "SUSPENDED":
        return "badge-suspended";
      case "EXPIRED":
        return "badge-expired";
      case "DRAFT":
        return "badge-draft";
      default:
        return "badge-draft";
    }
  }

  async function loadMandates(bId: string, aId: string) {
    loading = true;
    error = null;
    try {
      const res = await trackedFetch(
        `/proxy/obp/v6.0.0/banks/${encodeURIComponent(bId)}/accounts/${encodeURIComponent(aId)}/mandates`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      mandates = data.mandates;
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load mandates";
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (mandates.length > 0) {
      const activeCount = mandates.filter((m) => m.status === "ACTIVE").length;
      pageDataSummary.set(
        `${mandates.length} mandate${mandates.length === 1 ? "" : "s"} found. ${activeCount} active.`
      );
    } else if (!loading && !error) {
      pageDataSummary.set(`No mandates found.`);
    }
  });

  $effect(() => {
    if (bankId && accountId) {
      loadMandates(bankId, accountId);
    }
  });
</script>

<svelte:head>
  <title>Mandates - {bankId} / {accountId} - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb -->
  <nav class="breadcrumb mb-6" data-testid="breadcrumb">
    <a href="/mandates" class="breadcrumb-link">Mandates</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">{bankId} / {accountId}</span>
  </nav>

  {#if loading}
    <div class="loading-state" data-testid="loading-state">
      <Loader2 size={32} class="spinner-icon" />
      <p>Loading mandates...</p>
    </div>
  {:else if error}
    <div class="error-state" data-testid="error-state">
      <p class="error-message">{error}</p>
      <a
        href="/account-access/accounts/{encodeURIComponent(bankId)}/{encodeURIComponent(accountId)}/owner"
        class="btn-secondary mt-4"
        data-testid="back-to-account"
      >
        <ArrowLeft size={16} />
        Back to Account
      </a>
    </div>
  {:else}
    <div class="panel">
      <!-- Header -->
      <div class="panel-header">
        <div class="header-content">
          <div class="header-left">
            <div class="header-icon">
              <FileSignature size={24} />
            </div>
            <div>
              <h1 class="panel-title">Mandates</h1>
              <div class="panel-subtitle">
                {bankId} / {accountId}
              </div>
            </div>
          </div>
          <div class="header-actions">
            <a
              href="/account-access/accounts/{encodeURIComponent(bankId)}/{encodeURIComponent(accountId)}/owner"
              class="btn-secondary"
              data-testid="back-to-account"
            >
              <ArrowLeft size={16} />
              Account
            </a>
            <a
              href="/mandates/{encodeURIComponent(bankId)}/{encodeURIComponent(accountId)}/create"
              class="btn-primary"
              data-testid="create-mandate"
            >
              <Plus size={16} />
              Create Mandate
            </a>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="panel-content">
        {#if mandates.length === 0}
          <div class="empty-state" data-testid="empty-state">
            <p>No mandates found for this account.</p>
            <a
              href="/mandates/{encodeURIComponent(bankId)}/{encodeURIComponent(accountId)}/create"
              class="btn-primary mt-4"
              data-testid="create-mandate-empty"
            >
              <Plus size={16} />
              Create Mandate
            </a>
          </div>
        {:else}
          <div class="table-wrapper" data-testid="mandates-table">
            <table class="mandates-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Valid From</th>
                  <th>Valid To</th>
                </tr>
              </thead>
              <tbody>
                {#each mandates as mandate (mandate.mandate_id)}
                  <tr
                    data-testid="mandate-row-{mandate.mandate_id}"
                  >
                    <td>
                      <a
                        href="/mandates/{encodeURIComponent(bankId)}/{encodeURIComponent(accountId)}/{encodeURIComponent(mandate.mandate_id)}"
                        class="mandate-link"
                        data-testid="mandate-link-{mandate.mandate_id}"
                      >
                        {mandate.mandate_name}
                      </a>
                    </td>
                    <td class="code">{mandate.mandate_reference}</td>
                    <td>
                      <span class="status-badge {statusClass(mandate.status)}" data-testid="mandate-status-{mandate.mandate_id}">
                        {mandate.status}
                      </span>
                    </td>
                    <td>{formatDate(mandate.valid_from)}</td>
                    <td>{formatDate(mandate.valid_to)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
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
    padding: 1.25rem 1.5rem;
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
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: #eff6ff;
    color: #3b82f6;
    border-radius: 10px;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .header-icon {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-400));
  }

  .panel-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #111827;
    margin: 0 0 0.125rem 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.75rem;
    color: #6b7280;
    font-family: monospace;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background: #f3f4f6;
    color: #374151;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
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

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    white-space: nowrap;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  :global([data-mode="dark"]) .btn-primary {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-primary:hover {
    background: rgb(var(--color-primary-500));
  }

  .panel-content {
    padding: 1.25rem 1.5rem;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .mandates-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .mandates-table th {
    text-align: left;
    padding: 0.625rem 0.75rem;
    font-weight: 600;
    color: #6b7280;
    border-bottom: 2px solid #e5e7eb;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  :global([data-mode="dark"]) .mandates-table th {
    color: var(--color-surface-400);
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .mandates-table td {
    padding: 0.75rem;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
  }

  :global([data-mode="dark"]) .mandates-table td {
    border-bottom-color: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  .mandates-table tbody tr:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .mandates-table tbody tr:hover {
    background: rgb(var(--color-surface-700));
  }

  .mandate-link {
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
  }

  .mandate-link:hover {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .mandate-link {
    color: rgb(var(--color-primary-400));
  }

  .code {
    font-family: monospace;
    font-size: 0.8rem;
  }

  .status-badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .badge-active {
    background: #dcfce7;
    color: #166534;
  }

  :global([data-mode="dark"]) .badge-active {
    background: rgba(22, 163, 74, 0.2);
    color: rgb(var(--color-success-400));
  }

  .badge-suspended {
    background: #fef3c7;
    color: #92400e;
  }

  :global([data-mode="dark"]) .badge-suspended {
    background: rgba(245, 158, 11, 0.2);
    color: #fbbf24;
  }

  .badge-expired {
    background: #fee2e2;
    color: #991b1b;
  }

  :global([data-mode="dark"]) .badge-expired {
    background: rgba(220, 38, 38, 0.2);
    color: rgb(var(--color-error-400));
  }

  .badge-draft {
    background: #f3f4f6;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .badge-draft {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-400);
  }

  /* Empty / Loading / Error states */
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-400);
  }

  .loading-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  :global([data-mode="dark"]) .loading-state {
    color: var(--color-surface-400);
  }

  .loading-state :global(.spinner-icon) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .error-state {
    padding: 1.5rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 8px;
  }

  :global([data-mode="dark"]) .error-state {
    background: rgba(220, 38, 38, 0.1);
    border-color: rgba(220, 38, 38, 0.3);
  }

  .error-message {
    color: #991b1b;
    font-size: 0.875rem;
    margin: 0;
  }

  :global([data-mode="dark"]) .error-message {
    color: rgb(var(--color-error-300));
  }

  .mt-4 {
    margin-top: 1rem;
  }
</style>
