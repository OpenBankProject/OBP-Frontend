<script lang="ts">
  import { Building, Search, X, Loader2, Landmark } from "@lucide/svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";

  interface Customer {
    customer_id: string;
    customer_number: string;
    legal_name: string;
    email: string;
    mobile_phone_number: string;
    customer_type: string;
    date_of_birth: string;
    kyc_status: boolean;
    bank_id: string;
  }

  let customers = $state<Customer[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let searchQuery = $state("");

  let filteredCustomers = $derived.by(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.legal_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.customer_number?.toLowerCase().includes(q) ||
        c.customer_id?.toLowerCase().includes(q),
    );
  });

  async function fetchCustomers(bankId: string) {
    if (!bankId) {
      customers = [];
      error = null;
      return;
    }
    loading = true;
    error = null;
    try {
      const res = await trackedFetch(
        `/api/obp/banks/${encodeURIComponent(bankId)}/corporate-customers?limit=200`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch corporate customers");
      }
      const data = await res.json();
      customers = data.customers || [];
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to fetch corporate customers";
      customers = [];
    } finally {
      loading = false;
    }
  }

  // Re-fetch when bank changes
  $effect(() => {
    const bankId = currentBank.bankId;
    fetchCustomers(bankId);
  });
</script>

<svelte:head>
  <title>Corporate Customers - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div>
          <h1 class="panel-title">Corporate Customers</h1>
          <div class="panel-subtitle">
            {#if currentBank.bankId}
              Corporate customers at bank <strong>{currentBank.bankId}</strong>
            {:else}
              Select a bank to view corporate customers
            {/if}
          </div>
        </div>
      </div>
    </div>

    <div class="panel-content">
      {#if !currentBank.bankId}
        <div class="empty-state">
          <div class="empty-icon">
            <Landmark size={48} />
          </div>
          <h4 class="empty-title">No Bank Selected</h4>
          <p class="empty-description">
            Please <a href="/user">select a bank</a> to view corporate
            customers.
          </p>
        </div>
      {:else if loading}
        <div class="loading-state">
          <Loader2 size={32} class="spinner-icon" />
          <p>Loading corporate customers...</p>
        </div>
      {:else if error}
        <div class="error-state">
          <p class="error-message">{error}</p>
        </div>
      {:else}
        <div class="count-banner">
          <Building size={24} />
          <span class="count-number">{filteredCustomers.length}</span>
          <span class="count-label">
            {#if searchQuery.trim()}
              of {customers.length} customer{customers.length !== 1 ? "s" : ""}
            {:else}
              customer{customers.length !== 1 ? "s" : ""} at {currentBank.bankId}
            {/if}
          </span>
        </div>

        {#if customers.length > 0}
          <!-- Search -->
          <div class="search-wrapper">
            <Search class="search-icon" size={18} />
            <input
              type="text"
              class="search-input"
              placeholder="Filter by name, email, customer number, or ID..."
              bind:value={searchQuery}
            />
            {#if searchQuery}
              <button
                type="button"
                class="clear-button"
                onclick={() => (searchQuery = "")}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            {/if}
          </div>
        {/if}

        {#if filteredCustomers.length > 0}
          <div class="table-container">
            <table class="directory-table">
              <thead>
                <tr>
                  <th>Legal Name</th>
                  <th>Customer Number</th>
                  <th>Type</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>KYC Status</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredCustomers as customer}
                  <tr data-testid="customer-row-{customer.customer_id}">
                    <td class="cell-label">
                      <a href="/customers/{encodeURIComponent(customer.bank_id)}/{encodeURIComponent(customer.customer_id)}" class="customer-link" data-testid="customer-detail-link">
                        {customer.legal_name || "—"}
                      </a>
                    </td>
                    <td class="cell-mono">{customer.customer_number || "—"}</td>
                    <td>
                      {#if customer.customer_type}
                        <span class="badge">{customer.customer_type}</span>
                      {:else}
                        —
                      {/if}
                    </td>
                    <td>{customer.email || "—"}</td>
                    <td>{customer.mobile_phone_number || "—"}</td>
                    <td>
                      {#if customer.kyc_status === true}
                        <span class="badge badge-success">Verified</span>
                      {:else if customer.kyc_status === false}
                        <span class="badge badge-warning">Pending</span>
                      {:else}
                        —
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if searchQuery.trim()}
          <div class="empty-state">
            <h4 class="empty-title">No Matching Customers</h4>
            <p class="empty-description">
              No customers match "{searchQuery}".
            </p>
          </div>
        {:else}
          <div class="empty-state">
            <div class="empty-icon">
              <Building size={48} />
            </div>
            <h4 class="empty-title">No Customers</h4>
            <p class="empty-description">
              No corporate customers found for this bank.
            </p>
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
    align-items: center;
    gap: 1.5rem;
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

  .panel-content {
    padding: 2rem;
  }

  /* Count banner */
  .count-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    color: #166534;
  }

  :global([data-mode="dark"]) .count-banner {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.3);
    color: rgb(var(--color-success-300));
  }

  .count-number {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .count-label {
    font-size: 0.875rem;
  }

  /* Search */
  .search-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .search-wrapper :global(.search-icon) {
    position: absolute;
    left: 0.75rem;
    color: #9ca3af;
    pointer-events: none;
  }

  :global([data-mode="dark"]) .search-wrapper :global(.search-icon) {
    color: var(--color-surface-400);
  }

  .search-input {
    width: 100%;
    padding: 0.625rem 2.5rem 0.625rem 2.5rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  :global([data-mode="dark"]) .search-input {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .search-input:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }

  .clear-button {
    position: absolute;
    right: 0.75rem;
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    border-radius: 4px;
  }

  .clear-button:hover {
    color: #4b5563;
    background: #f3f4f6;
  }

  :global([data-mode="dark"]) .clear-button {
    color: var(--color-surface-400);
  }

  :global([data-mode="dark"]) .clear-button:hover {
    color: var(--color-surface-200);
    background: rgb(var(--color-surface-600));
  }

  /* Table */
  .table-container {
    overflow-x: auto;
  }

  .directory-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }

  .directory-table th {
    text-align: left;
    padding: 0.625rem 0.75rem;
    font-weight: 600;
    color: #6b7280;
    border-bottom: 2px solid #e5e7eb;
    white-space: nowrap;
  }

  :global([data-mode="dark"]) .directory-table th {
    color: var(--color-surface-400);
    border-bottom-color: rgb(var(--color-surface-600));
  }

  .directory-table td {
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
    vertical-align: top;
  }

  :global([data-mode="dark"]) .directory-table td {
    border-bottom-color: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  .directory-table tbody tr:hover {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .directory-table tbody tr:hover {
    background: rgb(var(--color-surface-700));
  }

  .cell-label {
    font-weight: 500;
    color: #111827;
  }

  :global([data-mode="dark"]) .cell-label {
    color: var(--color-surface-100);
  }

  .cell-label :global(.customer-link) {
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
  }

  .cell-label :global(.customer-link:hover) {
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .cell-label :global(.customer-link) {
    color: rgb(var(--color-primary-400));
  }

  .cell-mono {
    font-family: monospace;
    font-size: 0.75rem;
  }

  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 500;
    background: #eff6ff;
    color: #1e40af;
  }

  :global([data-mode="dark"]) .badge {
    background: rgba(59, 130, 246, 0.15);
    color: rgb(var(--color-primary-300));
  }

  .badge-success {
    background: #f0fdf4;
    color: #166534;
  }

  :global([data-mode="dark"]) .badge-success {
    background: rgba(34, 197, 94, 0.15);
    color: rgb(var(--color-success-300));
  }

  .badge-warning {
    background: #fffbeb;
    color: #92400e;
  }

  :global([data-mode="dark"]) .badge-warning {
    background: rgba(245, 158, 11, 0.15);
    color: rgb(var(--color-warning-300));
  }

  /* Empty/Loading/Error states */
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
    margin: 0;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-description {
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
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .error-state {
    padding: 1rem 1.5rem;
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 8px;
    margin: 1rem 0;
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

  @media (max-width: 768px) {
    .panel-content {
      padding: 1rem;
    }

    .directory-table th,
    .directory-table td {
      padding: 0.5rem;
    }
  }
</style>
