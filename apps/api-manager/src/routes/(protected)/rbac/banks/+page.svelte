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
  import { Search, Building2, Globe, AlertTriangle } from "@lucide/svelte";

  interface Bank {
    bank_id: string;
    short_name: string;
    full_name: string;
    logo?: string;
    website?: string;
    bank_routings?: Array<{
      scheme: string;
      address: string;
    }>;
  }

  let { data } = $props<{ data: PageData }>();

  let banks = $derived(data.banks || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  let searchQuery = $state("");

  let filteredBanks = $derived.by(() => {
    if (!searchQuery.trim()) return banks;

    const query = searchQuery.toLowerCase();
    return banks.filter(
      (bank: Bank) =>
        bank.bank_id.toLowerCase().includes(query) ||
        bank.short_name.toLowerCase().includes(query) ||
        bank.full_name.toLowerCase().includes(query),
    );
  });
</script>

<svelte:head>
  <title>Banks - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb mb-6">
    <a href="/rbac" class="breadcrumb-link">RBAC</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">Banks</span>
  </nav>

  <!-- Error Alert -->
  {#if error}
    <div class="alert alert-error mb-6">
      <AlertTriangle size={20} />
      <div>
        <strong>Error:</strong>
        {error}
      </div>
    </div>
  {/if}

  <div class="panel">
    <div class="panel-header">
      <div class="header-top">
        <div>
          <h1 class="panel-title">Banks</h1>
          <div class="panel-subtitle">
            View all banks in the Open Bank Project
          </div>
        </div>
        <div class="bank-count">
          <span class="count-number">{filteredBanks.length}</span>
          <span class="count-label">
            {filteredBanks.length === 1 ? "Bank" : "Banks"}
          </span>
        </div>
      </div>

      <!-- Search Bar -->
      <div class="search-container">
        <div class="search-input-wrapper">
          <Search class="search-icon" size={20} />
          <input
            type="text"
            class="search-input"
            placeholder="Search by bank ID, short name, or full name..."
            bind:value={searchQuery}
          />
          {#if searchQuery}
            <button
              class="clear-button"
              onclick={() => (searchQuery = "")}
              aria-label="Clear search"
            >
              ✕
            </button>
          {/if}
        </div>
        {#if searchQuery}
          <div class="search-results-info">
            Showing {filteredBanks.length} of {banks.length} banks
          </div>
        {/if}
      </div>
    </div>

    <div class="panel-content">
      {#if !hasApiAccess}
        <div class="empty-state">
          <div class="empty-icon">🏦</div>
          <h4 class="empty-title">No API Access</h4>
          <p class="empty-text">
            Unable to fetch banks. Please check your API access.
          </p>
        </div>
      {:else if filteredBanks.length === 0 && searchQuery}
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h4 class="empty-title">No banks found</h4>
          <p class="empty-text">
            No banks match your search for "{searchQuery}"
          </p>
        </div>
      {:else if banks.length === 0}
        <div class="empty-state">
          <div class="empty-icon">🏦</div>
          <h4 class="empty-title">No Banks</h4>
          <p class="empty-text">No banks are currently available.</p>
        </div>
      {:else}
        <div class="banks-grid">
          {#each filteredBanks as bank}
            <div class="bank-card">
              <div class="bank-header">
                {#if bank.logo && !bank.logo.includes('example.com')}
                  <img src={bank.logo} alt={bank.short_name} class="bank-logo" />
                {:else}
                  <div class="bank-logo-placeholder">
                    <Building2 size={32} />
                  </div>
                {/if}
                <div class="bank-header-info">
                  <h3 class="bank-name">{bank.short_name}</h3>
                  <div class="bank-id">{bank.bank_id}</div>
                </div>
              </div>

              <div class="bank-body">
                <div class="bank-detail">
                  <span class="detail-label">Full Name:</span>
                  <span class="detail-value">{bank.full_name}</span>
                </div>

                {#if bank.website}
                  <div class="bank-detail">
                    <span class="detail-label">Website:</span>
                    <a
                      href={bank.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="website-link"
                    >
                      <Globe size={14} />
                      {bank.website}
                    </a>
                  </div>
                {/if}

                {#if bank.bank_routings && bank.bank_routings.length > 0}
                  <div class="bank-detail">
                    <span class="detail-label">Routing:</span>
                    <div class="routing-list">
                      {#each bank.bank_routings as routing}
                        <div class="routing-item">
                          <span class="routing-scheme">{routing.scheme}:</span>
                          <span class="routing-address">{routing.address}</span>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
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

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }

  .panel-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--ui-text);
    margin: 0;
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: var(--ui-muted);
    margin-top: 0.25rem;
  }

  .bank-count {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    padding: 0.75rem 1rem;
    background: var(--ui-card);
    border-radius: 8px;
    min-width: 100px;
  }

  .count-number {
    font-size: 2rem;
    font-weight: 700;
    color: var(--ui-link);
    line-height: 1;
  }

  .count-label {
    font-size: 0.875rem;
    color: var(--ui-muted);
    margin-top: 0.25rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .search-container {
    margin-top: 1rem;
  }

  :global([data-mode="dark"]) .search-container {
    background: transparent;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input-wrapper :global(.search-icon) {
    position: absolute;
    left: 1rem;
    color: var(--ui-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 3rem 0.75rem 3rem;
    border: 1px solid var(--ui-border);
    border-radius: 8px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-link) 10%, transparent);
  }

  .clear-button {
    position: absolute;
    right: 1rem;
    padding: 0.25rem;
    background: none;
    border: none;
    color: var(--ui-muted);
    cursor: pointer;
    font-size: 1.25rem;
    line-height: 1;
    transition: color 0.2s;
  }

  .clear-button:hover {
    color: var(--ui-muted);
  }

  .search-results-info {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: var(--ui-muted);
  }

  .panel-content {
    padding: 1.5rem;
  }

  .alert {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    border-radius: 0.375rem;
  }

  .alert-error {
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
    border: 1px solid var(--ui-tone-error-border);
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: var(--ui-muted);
  }

  .empty-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  .empty-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--ui-text);
    margin-bottom: 0.5rem;
  }

  .empty-text {
    color: var(--ui-muted);
  }

  .banks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .bank-card {
    background: var(--ui-card);
    border: 1px solid var(--ui-border);
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.2s;
  }

  .bank-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  .bank-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    background: var(--ui-card);
    border-bottom: 1px solid var(--ui-border);
  }

  .bank-logo {
    width: 48px;
    height: 48px;
    object-fit: contain;
    border-radius: 8px;
  }

  .bank-logo-placeholder {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ui-panel);
    border-radius: 8px;
    color: var(--ui-muted);
  }

  .bank-header-info {
    flex: 1;
    min-width: 0;
  }

  .bank-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0 0 0.25rem 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bank-id {
    font-size: 0.75rem;
    font-family: monospace;
    color: var(--ui-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .bank-body {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .bank-detail {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .detail-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--ui-muted);
    letter-spacing: 0.05em;
  }

  .detail-value {
    font-size: 0.875rem;
    color: var(--ui-text);
  }

  .website-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--ui-link);
    text-decoration: none;
    transition: color 0.2s;
  }

  .website-link:hover {
    color: var(--ui-link-hover);
    text-decoration: underline;
  }

  .routing-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .routing-item {
    display: flex;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .routing-scheme {
    font-weight: 600;
    color: var(--ui-muted);
  }

  .routing-address {
    font-family: monospace;
    color: var(--ui-text);
  }

  @media (max-width: 768px) {
    .header-top {
      flex-direction: column;
      gap: 1rem;
    }

    .bank-count {
      align-self: stretch;
      align-items: center;
    }

    .banks-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
