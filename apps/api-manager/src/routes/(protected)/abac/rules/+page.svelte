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
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";
  import { Lock, Shield, Search, Edit, Eye } from "@lucide/svelte";

  let { data } = $props<{ data: PageData }>();

  function handleCreateRule() {
    goto("/abac/rules/create");
  }

  function handleViewRule(ruleId: string) {
    goto(`/abac/rules/${ruleId}/test`);
  }

  function handleEditRule(ruleId: string) {
    goto(`/abac/rules/${ruleId}/edit`);
  }

  let abacRules = $derived(data.abacRules || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  // Search functionality
  let searchQuery = $state("");

  let filteredRules = $derived.by(() => {
    if (!searchQuery.trim()) {
      console.log("ABAC Rules Data:", abacRules);
      return abacRules;
    }
    const query = searchQuery.toLowerCase();
    return abacRules.filter(
      (rule: any) =>
        rule.rule_name?.toLowerCase().includes(query) ||
        rule.description?.toLowerCase().includes(query) ||
        rule.rule_code?.toLowerCase().includes(query),
    );
  });
</script>

<svelte:head>
  <title>ABAC Rules - API Manager II</title>
</svelte:head>

  <div class="container mx-auto px-4 py-8">
    <div class="panel">
      <div class="panel-header">
        <div class="header-content">
          <div>
            <h1 class="panel-title">ABAC Rules</h1>
            <div class="panel-subtitle">
              Attribute-Based Access Control rules
            </div>
          </div>
          <div class="header-actions">
            <button onclick={handleCreateRule} class="btn-primary">
              Create ABAC Rule
            </button>
          </div>
        </div>
      </div>

      <div class="panel-content">
        {#if error}
          <div class="error-message">
            <p>⚠️ {error}</p>
            <p class="error-details">
              <strong>API Access:</strong>
              {hasApiAccess ? "Yes" : "No"}
            </p>
          </div>
        {/if}

        {#if abacRules.length === 0}
          <div class="empty-state">
            <div class="empty-icon">
              <Lock size={48} />
            </div>
            <h4 class="empty-title">No ABAC Rules Found</h4>
            <p class="empty-description">
              There are currently no ABAC rules configured. Rules may need to be
              created first or you may need specific permissions to see them.
            </p>
            <div class="debug-info">
              <p><strong>API Access:</strong> {hasApiAccess ? "Yes" : "No"}</p>
              <p><strong>Rules Count:</strong> {abacRules.length}</p>
              <p><strong>Error:</strong> {error || "None"}</p>
              <p class="debug-hint">
                Check browser console and server logs for detailed error
                information
              </p>
            </div>
          </div>
        {:else}
          <!-- Search Bar -->
          <div class="search-bar">
            <Search class="search-icon" size={18} />
            <input
              type="text"
              class="search-input"
              placeholder="Search rules by name, description, or operation..."
              bind:value={searchQuery}
            />
          </div>

          <!-- Stats -->
          <div class="stats">
            <div class="stat-item">
              <div class="stat-label">Total Rules</div>
              <div class="stat-value">{abacRules.length}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Showing</div>
              <div class="stat-value">{filteredRules.length}</div>
            </div>
          </div>

          <!-- Rules List -->
          {#if filteredRules.length === 0}
            <div class="empty-state">
              <div class="empty-icon">
                <Search size={48} />
              </div>
              <h4 class="empty-title">No rules found</h4>
              <p class="empty-description">Try adjusting your search query</p>
            </div>
          {:else}
            <div class="rules-list">
              {#each filteredRules as rule}
                <div class="rule-card">
                  <div class="rule-header">
                    <div class="rule-icon">
                      <Shield size={20} />
                    </div>
                    <div class="rule-title-section">
                      <h3 class="rule-name">
                        {rule.rule_name || "Unnamed Rule"}
                      </h3>
                    </div>
                    <div class="rule-actions">
                      <button
                        onclick={() => handleViewRule(rule.abac_rule_id)}
                        class="action-button view-button"
                        title="Test rule"
                      >
                        <Eye size={16} />
                        Test
                      </button>
                      <button
                        onclick={() => handleEditRule(rule.abac_rule_id)}
                        class="action-button edit-button"
                        title="Edit rule"
                      >
                        <Edit size={16} />
                        Edit
                      </button>
                    </div>
                  </div>

                  {#if rule.description}
                    <p class="rule-description">{rule.description}</p>
                  {/if}

                  <div class="rule-details">
                    {#if rule.rule_code}
                      <div class="detail-item">
                        <span class="detail-label">Rule Code:</span>
                        <code class="detail-value font-mono text-xs"
                          >{rule.rule_code}</code
                        >
                      </div>
                    {/if}

                    <div class="detail-item">
                      <span class="detail-label">Policy:</span>
                      <span class="detail-value"
                        >{rule.policy || "(not set)"}</span
                      >
                    </div>

                    {#if rule.is_active !== undefined}
                      <div class="detail-item">
                        <span class="detail-label">Status:</span>
                        <span
                          class="status-badge {rule.is_active
                            ? 'status-active'
                            : 'status-inactive'}"
                        >
                          {rule.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    {/if}

                    {#if rule.created_at}
                      <div class="detail-item">
                        <span class="detail-label">Created:</span>
                        <span class="detail-value"
                          >{new Date(
                            rule.created_at,
                          ).toLocaleDateString()}</span
                        >
                      </div>
                    {/if}
                  </div>
                </div>
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
    border-radius: 0.75rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }

  :global([data-mode="dark"]) .panel {
    background: rgb(31, 41, 55);
  }

  .panel-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(55, 65, 81);
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .header-actions {
    flex-shrink: 0;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  :global([data-mode="dark"]) .btn-primary {
    background: #3b82f6;
  }

  :global([data-mode="dark"]) .btn-primary:hover {
    background: #2563eb;
  }

  .panel-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: #f9fafb;
  }

  .panel-subtitle {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: #9ca3af;
  }

  .panel-content {
    padding: 1.5rem;
  }

  .error-message {
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.5rem;
    color: #991b1b;
    margin-bottom: 1rem;
  }

  :global([data-mode="dark"]) .error-message {
    background: rgba(220, 38, 38, 0.1);
    border-color: rgba(220, 38, 38, 0.3);
    color: #fca5a5;
  }

  .error-details {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    opacity: 0.9;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
  }

  .empty-icon {
    display: inline-flex;
    padding: 1rem;
    background: #f3f4f6;
    border-radius: 50%;
    color: #9ca3af;
    margin-bottom: 1rem;
  }

  :global([data-mode="dark"]) .empty-icon {
    background: rgb(55, 65, 81);
  }

  .empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin-bottom: 0.5rem;
  }

  :global([data-mode="dark"]) .empty-title {
    color: #f9fafb;
  }

  .empty-description {
    color: #6b7280;
  }

  :global([data-mode="dark"]) .empty-description {
    color: #9ca3af;
  }

  .debug-info {
    margin-top: 1.5rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    text-align: left;
    max-width: 400px;
    margin-left: auto;
    margin-right: auto;
  }

  :global([data-mode="dark"]) .debug-info {
    background: rgb(17, 24, 39);
  }

  .debug-hint {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #e5e7eb;
    font-style: italic;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .debug-hint {
    border-top-color: rgb(55, 65, 81);
    color: #9ca3af;
  }

  .search-bar {
    position: relative;
    margin-bottom: 1.5rem;
  }

  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 3rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    background: white;
    color: #111827;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  :global([data-mode="dark"]) .search-input {
    background: rgb(17, 24, 39);
    border-color: rgb(55, 65, 81);
    color: #f9fafb;
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
    border-radius: 0.5rem;
  }

  :global([data-mode="dark"]) .stat-item {
    background: rgb(17, 24, 39);
  }

  .stat-label {
    font-size: 0.875rem;
    color: #6b7280;
    display: block;
    margin-bottom: 0.25rem;
  }

  :global([data-mode="dark"]) .stat-label {
    color: #9ca3af;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
  }

  :global([data-mode="dark"]) .stat-value {
    color: #f9fafb;
  }

  .rules-list {
    display: grid;
    gap: 1rem;
  }

  .rule-card {
    padding: 1.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background: white;
  }

  :global([data-mode="dark"]) .rule-card {
    background: rgb(17, 24, 39);
    border-color: rgb(55, 65, 81);
  }

  .rule-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
    position: relative;
  }

  .rule-actions {
    display: flex;
    gap: 0.5rem;
    margin-left: auto;
  }

  .action-button {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-button:hover {
    background: #f9fafb;
  }

  .view-button:hover {
    border-color: #10b981;
    color: #10b981;
  }

  .edit-button:hover {
    border-color: #3b82f6;
    color: #3b82f6;
  }

  :global([data-mode="dark"]) .action-button {
    background: rgb(55, 65, 81);
    border-color: rgb(75, 85, 99);
    color: #d1d5db;
  }

  :global([data-mode="dark"]) .action-button:hover {
    background: rgb(75, 85, 99);
  }

  :global([data-mode="dark"]) .view-button:hover {
    border-color: #10b981;
    color: #10b981;
  }

  :global([data-mode="dark"]) .edit-button:hover {
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .rule-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    background: #dbeafe;
    border-radius: 0.5rem;
    color: #3b82f6;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .rule-icon {
    background: rgba(59, 130, 246, 0.1);
  }

  .rule-title-section {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .rule-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .rule-name {
    color: #f9fafb;
  }

  .operation-badge {
    display: inline-flex;
    padding: 0.25rem 0.75rem;
    background: #f3f4f6;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: #374151;
    font-family: monospace;
  }

  :global([data-mode="dark"]) .operation-badge {
    background: rgb(55, 65, 81);
    color: #d1d5db;
  }

  .rule-description {
    color: #6b7280;
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  :global([data-mode="dark"]) .rule-description {
    color: #9ca3af;
  }

  .rule-details {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    margin-bottom: 1rem;
  }

  .detail-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
  }

  .detail-label {
    color: #6b7280;
    font-weight: 500;
  }

  :global([data-mode="dark"]) .detail-label {
    color: #9ca3af;
  }

  .detail-value {
    color: #111827;
  }

  :global([data-mode="dark"]) .detail-value {
    color: #f9fafb;
  }

  .status-badge {
    display: inline-flex;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .status-active {
    background: #10b981;
    color: #ffffff;
  }

  .status-inactive {
    background: #ef4444;
    color: #ffffff;
  }

  .attributes-section {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .attributes-section {
    border-top-color: rgb(55, 65, 81);
  }

  .attributes-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  :global([data-mode="dark"]) .attributes-title {
    color: #d1d5db;
  }

  .attributes-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .attribute-item {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.75rem;
    background: #f3f4f6;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-family: monospace;
  }

  :global([data-mode="dark"]) .attribute-item {
    background: rgb(55, 65, 81);
  }

  .attribute-key {
    color: #3b82f6;
    font-weight: 600;
  }

  .attribute-value {
    color: #6b7280;
  }

  :global([data-mode="dark"]) .attribute-value {
    color: #9ca3af;
  }

  @media (max-width: 768px) {
    .panel-header,
    .panel-content {
      padding: 1rem;
    }

    .rule-header {
      flex-direction: column;
    }

    .rule-details {
      flex-direction: column;
      gap: 0.75rem;
    }
  }
</style>
