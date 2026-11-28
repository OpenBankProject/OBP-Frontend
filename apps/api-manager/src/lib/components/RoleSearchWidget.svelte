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
  import { Search, Globe, Building2 } from "@lucide/svelte";

  interface Role {
    role: string;
    requires_bank_id: boolean;
  }

  interface Props {
    roles: Role[];
    selectedRole?: string;
    roleScope?: "all" | "system" | "bank";
    bankId?: string;
    disabled?: boolean;
    searchQuery?: string;
    hideSearch?: boolean;
  }

  let {
    roles,
    selectedRole = $bindable(""),
    roleScope = $bindable<"all" | "system" | "bank">("all"),
    bankId = "",
    disabled = false,
    searchQuery = $bindable(""),
    hideSearch = false,
  }: Props = $props();

  // Filter roles based on search query only
  let filteredRoles = $derived.by(() => {
    let filtered = roles;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((role) =>
        role.role.toLowerCase().includes(query),
      );
    }

    return filtered;
  });

  // Automatically set roleScope based on the selected role
  $effect(() => {
    if (selectedRole) {
      const role = roles.find((r) => r.role === selectedRole);
      if (role) {
        roleScope = role.requires_bank_id ? "bank" : "system";
      }
    } else {
      roleScope = "all";
    }
  });

</script>

<div class="role-search-widget">
  {#if !hideSearch}
    <!-- Search Box -->
    <div class="search-wrapper">
      <Search class="search-icon" size={16} />
      <input
        type="text"
        class="search-input"
        placeholder="Search roles..."
        bind:value={searchQuery}
        {disabled}
      />
    </div>
  {/if}

  <!-- Role Selection -->
  <div class="role-selector">
    {#if filteredRoles.length === 0}
      <div class="empty-roles">
        <p>
          No roles found
          {searchQuery ? `matching "${searchQuery}"` : ""}
        </p>
      </div>
    {:else}
      <div class="roles-grid">
        {#each filteredRoles as role}
          <label class="role-option">
            <input
              type="radio"
              name="role"
              value={role.role}
              bind:group={selectedRole}
              {disabled}
            />
            <div class="role-option-content">
              <span class="role-option-name">{role.role}</span>
              <span class="role-option-badge" class:badge-system={!role.requires_bank_id} class:badge-bank={role.requires_bank_id}>
                {#if role.requires_bank_id}
                  {#if selectedRole === role.role && bankId}
                    <Building2 size={11} />
                    <code class="bank-code">{bankId}</code>
                  {:else}
                    <Building2 size={11} />
                    Bank-level
                  {/if}
                {:else}
                  <Globe size={11} />
                  System-wide
                {/if}
              </span>
            </div>
          </label>
        {/each}
      </div>
    {/if}
  </div>

</div>

<style>
  .role-search-widget {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .search-wrapper :global(.search-icon) {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--ui-muted);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.625rem 0.75rem 0.625rem 2.5rem;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-link) 10%, transparent);
  }

  .search-input:disabled {
    background: var(--ui-card);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .role-selector {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    padding: 0.5rem;
  }

  .roles-grid {
    display: grid;
    gap: 0.25rem;
  }

  .role-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .role-option:has(input:checked) {
    background: var(--ui-tone-accent-bg);
    border-color: var(--ui-link);
  }

  .role-option:hover {
    background: var(--ui-hover);
  }

  .role-option input[type="radio"] {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
  }

  .role-option-content {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .role-option-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--ui-text);
  }

  .role-option-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.65rem;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .role-option-badge.badge-system {
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
  }

  .role-option-badge.badge-bank {
    background: var(--ui-tone-warning-bg);
    color: var(--ui-tone-warning-text);
  }

  .empty-roles {
    padding: 2rem;
    text-align: center;
    color: var(--ui-muted);
    font-size: 0.875rem;
  }

  .bank-code {
    font-family: monospace;
    font-size: 0.65rem;
    font-weight: 600;
  }
</style>
