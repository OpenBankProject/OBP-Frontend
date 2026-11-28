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
  import { ArrowLeft, Loader2, ArrowLeftRight } from "@lucide/svelte";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";

  interface CounterpartyDetail {
    name: string;
    description: string;
    currency: string;
    created_by_user_id: string;
    this_bank_id: string;
    this_account_id: string;
    this_view_id: string;
    counterparty_id: string;
    other_bank_routing_scheme: string;
    other_bank_routing_address: string;
    other_branch_routing_scheme: string;
    other_branch_routing_address: string;
    other_account_routing_scheme: string;
    other_account_routing_address: string;
    other_account_secondary_routing_scheme: string;
    other_account_secondary_routing_address: string;
    is_beneficiary: boolean;
    bespoke: Array<{ key: string; value: string }>;
    metadata: {
      public_alias: string;
      more_info: string;
      url: string;
      image_url: string;
      open_corporates_url: string;
      corporate_location: {
        latitude: number;
        longitude: number;
        date: string;
        user: { id: string; provider: string; username: string };
      };
      physical_location: {
        latitude: number;
        longitude: number;
        date: string;
        user: { id: string; provider: string; username: string };
      };
      private_alias: string;
    };
  }

  let counterparty = $state<CounterpartyDetail | null>(null);
  let loading = $state(false);
  let error = $state<string | null>(null);

  let bankId = $derived(page.params.bank_id || "");
  let accountId = $derived(page.params.account_id || "");
  let viewId = $derived(page.params.view_id || "");
  let counterpartyId = $derived(page.params.counterparty_id || "");

  let parsedError = $derived.by(() => {
    if (!error) return null;
    const match = error.match(/OBP-(\d+):.*missing one or more roles:\s*(.+)/i);
    if (match) {
      const roles = match[2].split(",").map((r: string) => r.trim());
      return { type: "missing_role" as const, code: match[1], roles, message: error };
    }
    return { type: "general" as const, message: error };
  });

  let accountPath = $derived(
    `/account-access/accounts/${encodeURIComponent(bankId)}/${encodeURIComponent(accountId)}/${encodeURIComponent(viewId)}`
  );

  let counterpartiesPath = $derived(`${accountPath}/counterparties`);

  async function fetchCounterparty(bankId: string, accountId: string, viewId: string, counterpartyId: string) {
    loading = true;
    error = null;
    try {
      const res = await trackedFetch(
        `/proxy/obp/v5.1.0/banks/${encodeURIComponent(bankId)}/accounts/${encodeURIComponent(accountId)}/${encodeURIComponent(viewId)}/counterparties/${encodeURIComponent(counterpartyId)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || `HTTP ${res.status} Failed to fetch counterparty details`);
      }
      counterparty = await res.json();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch counterparty details";
      counterparty = null;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (bankId && accountId && viewId && counterpartyId) {
      fetchCounterparty(bankId, accountId, viewId, counterpartyId);
    }
  });
</script>

<svelte:head>
  <title>{counterparty?.name || "Counterparty Detail"} - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb -->
  <nav class="breadcrumb mb-4" aria-label="Breadcrumb">
    <a href="/account-access/accounts" class="breadcrumb-link">Accounts</a>
    <span class="breadcrumb-separator">&rsaquo;</span>
    <a href={accountPath} class="breadcrumb-link">{accountId}</a>
    <span class="breadcrumb-separator">&rsaquo;</span>
    <a href={counterpartiesPath} class="breadcrumb-link">Counterparties</a>
    <span class="breadcrumb-separator">&rsaquo;</span>
    <span class="breadcrumb-current">{counterparty?.name || counterpartyId}</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-icon">
          <ArrowLeftRight size={28} />
        </div>
        <div>
          <h1 class="panel-title" data-testid="counterparty-name">
            {counterparty?.name || "Counterparty Detail"}
          </h1>
          <div class="panel-subtitle">{bankId} / {accountId} / {viewId}</div>
        </div>
        <a href={counterpartiesPath} class="btn-secondary" data-testid="back-button">
          <ArrowLeft size={16} />
          Back
        </a>
      </div>
    </div>

    <div class="panel-content">
      {#if loading}
        <div class="loading-state">
          <Loader2 size={32} class="spinner-icon" />
          <p>Loading counterparty details...</p>
        </div>
      {:else if error}
        {#if parsedError && parsedError.type === "missing_role"}
          <MissingRoleAlert
            roles={parsedError.roles}
            errorCode={parsedError.code}
            message={parsedError.message}
            bankId={bankId}
          />
        {:else}
          <div class="error-state">
            <p class="error-message">{error}</p>
          </div>
        {/if}
      {:else if counterparty}
        <!-- Basic Info -->
        <section class="detail-section">
          <h2 class="section-title">Counterparty Information</h2>
          <div class="info-grid" data-testid="counterparty-info">
            <div class="info-item">
              <span class="info-label">Counterparty ID</span>
              <span class="info-value mono">{counterparty.counterparty_id}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Name</span>
              <span class="info-value">{counterparty.name || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Description</span>
              <span class="info-value">{counterparty.description || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Currency</span>
              <span class="info-value">{counterparty.currency || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Beneficiary</span>
              <span class="info-value">
                {#if counterparty.is_beneficiary === true}
                  <span class="badge badge-success">Yes</span>
                {:else if counterparty.is_beneficiary === false}
                  <span class="badge badge-neutral">No</span>
                {:else}
                  —
                {/if}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Created By User</span>
              <span class="info-value mono">{counterparty.created_by_user_id || "—"}</span>
            </div>
          </div>
        </section>

        <!-- This Account Context -->
        <section class="detail-section">
          <h2 class="section-title">This Account</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Bank ID</span>
              <span class="info-value mono">{counterparty.this_bank_id || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Account ID</span>
              <span class="info-value mono">{counterparty.this_account_id || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">View ID</span>
              <span class="info-value">{counterparty.this_view_id || "—"}</span>
            </div>
          </div>
        </section>

        <!-- Other Bank Routing -->
        <section class="detail-section">
          <h2 class="section-title">Routing Information</h2>
          <div class="info-grid" data-testid="counterparty-routing">
            <div class="info-item">
              <span class="info-label">Bank Routing Scheme</span>
              <span class="info-value">
                {#if counterparty.other_bank_routing_scheme}
                  <span class="routing-scheme">{counterparty.other_bank_routing_scheme}</span>
                {:else}
                  —
                {/if}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Bank Routing Address</span>
              <span class="info-value mono">{counterparty.other_bank_routing_address || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Branch Routing Scheme</span>
              <span class="info-value">
                {#if counterparty.other_branch_routing_scheme}
                  <span class="routing-scheme">{counterparty.other_branch_routing_scheme}</span>
                {:else}
                  —
                {/if}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Branch Routing Address</span>
              <span class="info-value mono">{counterparty.other_branch_routing_address || "—"}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Account Routing Scheme</span>
              <span class="info-value">
                {#if counterparty.other_account_routing_scheme}
                  <span class="routing-scheme">{counterparty.other_account_routing_scheme}</span>
                {:else}
                  —
                {/if}
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Account Routing Address</span>
              <span class="info-value mono">{counterparty.other_account_routing_address || "—"}</span>
            </div>
            {#if counterparty.other_account_secondary_routing_scheme || counterparty.other_account_secondary_routing_address}
              <div class="info-item">
                <span class="info-label">Secondary Routing Scheme</span>
                <span class="info-value">
                  {#if counterparty.other_account_secondary_routing_scheme}
                    <span class="routing-scheme">{counterparty.other_account_secondary_routing_scheme}</span>
                  {:else}
                    —
                  {/if}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">Secondary Routing Address</span>
                <span class="info-value mono">{counterparty.other_account_secondary_routing_address || "—"}</span>
              </div>
            {/if}
          </div>
        </section>

        <!-- Metadata -->
        {#if counterparty.metadata}
          <section class="detail-section">
            <h2 class="section-title">Metadata</h2>
            <div class="info-grid" data-testid="counterparty-metadata">
              <div class="info-item">
                <span class="info-label">Public Alias</span>
                <span class="info-value">{counterparty.metadata.public_alias || "—"}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Private Alias</span>
                <span class="info-value">{counterparty.metadata.private_alias || "—"}</span>
              </div>
              <div class="info-item">
                <span class="info-label">More Info</span>
                <span class="info-value">{counterparty.metadata.more_info || "—"}</span>
              </div>
              <div class="info-item">
                <span class="info-label">URL</span>
                <span class="info-value">{counterparty.metadata.url || "—"}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Image URL</span>
                <span class="info-value">{counterparty.metadata.image_url || "—"}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Open Corporates URL</span>
                <span class="info-value">{counterparty.metadata.open_corporates_url || "—"}</span>
              </div>
            </div>

            {#if counterparty.metadata.corporate_location?.latitude}
              <div class="location-section">
                <h3 class="subsection-title">Corporate Location</h3>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">Latitude</span>
                    <span class="info-value">{counterparty.metadata.corporate_location.latitude}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Longitude</span>
                    <span class="info-value">{counterparty.metadata.corporate_location.longitude}</span>
                  </div>
                </div>
              </div>
            {/if}

            {#if counterparty.metadata.physical_location?.latitude}
              <div class="location-section">
                <h3 class="subsection-title">Physical Location</h3>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="info-label">Latitude</span>
                    <span class="info-value">{counterparty.metadata.physical_location.latitude}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">Longitude</span>
                    <span class="info-value">{counterparty.metadata.physical_location.longitude}</span>
                  </div>
                </div>
              </div>
            {/if}
          </section>
        {/if}

        <!-- Bespoke -->
        {#if counterparty.bespoke && counterparty.bespoke.length > 0}
          <section class="detail-section">
            <h2 class="section-title">Bespoke Data</h2>
            <div class="table-container">
              <table class="detail-table" data-testid="counterparty-bespoke-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {#each counterparty.bespoke as item}
                    <tr data-testid="bespoke-row-{item.key}">
                      <td class="cell-label">{item.key}</td>
                      <td>{item.value}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </section>
        {/if}
      {/if}
    </div>
  </div>
</div>

<style>
  .container {
    max-width: 1200px;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
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

  .header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    background: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
    flex-shrink: 0;
  }

  .panel-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--ui-text);
    margin: 0;
  }

  .panel-subtitle {
    font-size: 0.75rem;
    color: var(--ui-muted);
    font-family: monospace;
    margin-top: 0.25rem;
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
    text-decoration: none;
    white-space: nowrap;
    margin-left: auto;
  }

  .btn-secondary:hover {
    background: var(--ui-hover);
  }

  .panel-content {
    padding: 1.5rem;
  }

  /* Sections */
  .detail-section {
    margin-bottom: 2rem;
  }

  .detail-section:last-child {
    margin-bottom: 0;
  }

  .section-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--ui-text);
    margin: 0 0 1rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .subsection-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--ui-muted);
    margin: 1rem 0 0.75rem 0;
  }

  /* Info grid */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--ui-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .info-value {
    font-size: 0.875rem;
    color: var(--ui-text);
  }

  .mono {
    font-family: monospace;
    font-size: 0.8rem;
  }

  .routing-scheme {
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    border-radius: 3px;
    text-transform: uppercase;
  }

  .location-section {
    margin-top: 0.5rem;
  }

  /* Badge */
  .badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .badge-success {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .badge-neutral {
    background: var(--ui-panel);
    color: var(--ui-muted);
  }

  /* Table */
  .table-container {
    overflow-x: auto;
  }

  .detail-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }

  .detail-table th {
    text-align: left;
    padding: 0.625rem 0.75rem;
    font-weight: 600;
    color: var(--ui-muted);
    border-bottom: 2px solid var(--ui-border);
    white-space: nowrap;
  }

  .detail-table td {
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--ui-border);
    color: var(--ui-text);
    vertical-align: top;
  }

  .detail-table tbody tr:hover {
    background: var(--ui-hover);
  }

  .cell-label {
    font-weight: 500;
    color: var(--ui-text);
  }

  /* States */
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
    padding: 1rem 1.5rem;
    background: var(--ui-tone-error-bg);
    border: 1px solid var(--ui-tone-error-border);
    border-radius: 8px;
  }

  .error-message {
    color: var(--ui-error);
    font-size: 0.875rem;
    margin: 0;
  }

  @media (max-width: 768px) {
    .panel-content {
      padding: 1rem;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .header-content {
      flex-wrap: wrap;
    }
  }
</style>
