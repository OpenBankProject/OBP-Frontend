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
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--ui-border);
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
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    border-radius: 10px;
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--ui-text);
    margin: 0 0 0.125rem 0;
  }

  .panel-subtitle {
    font-size: 0.75rem;
    color: var(--ui-muted);
    font-family: monospace;
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
    background: var(--ui-panel);
    color: var(--ui-text);
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
    background: var(--ui-hover);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.875rem;
    background: var(--ui-fill-main-bg);
    color: var(--ui-fill-main-text);
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
    opacity: 0.85;
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
    color: var(--ui-muted);
    border-bottom: 2px solid var(--ui-border);
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .mandates-table td {
    padding: 0.75rem;
    border-bottom: 1px solid var(--ui-border);
    color: var(--ui-text);
  }

  .mandates-table tbody tr:hover {
    background: var(--ui-hover);
  }

  .mandate-link {
    color: var(--ui-link);
    text-decoration: none;
    font-weight: 500;
  }

  .mandate-link:hover {
    text-decoration: underline;
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
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .badge-suspended {
    background: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
  }

  .badge-expired {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
  }

  .badge-draft {
    background: var(--ui-panel);
    color: var(--ui-muted);
  }

  /* Empty / Loading / Error states */
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--ui-muted);
  }

  .loading-state {
    text-align: center;
    padding: 3rem;
    color: var(--ui-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
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
    background: var(--ui-tone-error-bg);
    border: 1px solid var(--ui-tone-error-border);
    border-radius: 8px;
  }

  .error-message {
    color: var(--ui-error);
    font-size: 0.875rem;
    margin: 0;
  }

  .mt-4 {
    margin-top: 1rem;
  }
</style>
