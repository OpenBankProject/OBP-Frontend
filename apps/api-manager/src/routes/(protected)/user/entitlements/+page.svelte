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
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import { enhance } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { Building2, Globe, KeyRound, Plus, ChevronDown, Check, X, Box, AppWindow } from "@lucide/svelte";
  import RoleSearchWidget from "$lib/components/RoleSearchWidget.svelte";

  const { data, form } = $props();

  // Reactive references so lists update after enhance submissions
  let userEntitlements = $derived(data.userEntitlements);
  let allEntitlements = $derived(data.allAvailableEntitlements);

  let copiedId = $state<string | null>(null);

  async function copyToClipboard(
    roleName: string,
    entitlementId: string,
    bankId: string,
    id: string,
  ) {
    const textToCopy = `Role: ${roleName}\nEntitlement ID: ${entitlementId}\nBank ID: ${bankId}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      copiedId = id;
      setTimeout(() => {
        copiedId = null;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }

  // Check if user can create entitlements
  let canCreateEntitlements = $derived(
    userEntitlements.some((entitlement: any) =>
      ["CanCreateEntitlementAtAnyBank", "CanCreateEntitlementAtOneBank"].includes(
        entitlement.role_name,
      ),
    ),
  );

  // Roles needed to create entitlements — different for system vs bank
  const systemRequiredRoles = ["CanCreateEntitlementAtAnyBank"];
  const bankRequiredRoles = ["CanCreateEntitlementAtAnyBank", "CanCreateEntitlementAtOneBank"];
  let userRoleNames = $derived(new Set(userEntitlements.map((e: any) => e.role_name)));

  // Pre-filtered role lists for each widget
  let systemRoles = $derived(allEntitlements.filter((r: any) => !r.requires_bank_id));
  let bankRoles = $derived(allEntitlements.filter((r: any) => r.requires_bank_id));

  // Separate widget state
  let systemExpanded = $state(false);
  let bankExpanded = $state(false);
  let systemSelectedRole = $state("");
  let bankSelectedRole = $state("");

  // Inline feedback state
  let systemSuccess = $state("");
  let bankSuccess = $state("");
  let systemError = $state("");
  let bankError = $state("");

  // Check if user already has the selected role
  let alreadyHasSystemRole = $derived(
    systemSelectedRole && userEntitlements.some((e: any) => e.role_name === systemSelectedRole && !e.bank_id),
  );
  let alreadyHasBankRole = $derived(
    bankSelectedRole && userEntitlements.some((e: any) => e.role_name === bankSelectedRole && e.bank_id === currentBank.bankId),
  );

  function systemEnhance() {
    systemSuccess = "";
    systemError = "";
    return async ({ result }: any) => {
      if (result.type === "success") {
        const roleName = systemSelectedRole;
        systemSelectedRole = "";
        await invalidateAll();
        systemSuccess = `Added "${roleName}" successfully.`;
        setTimeout(() => { systemSuccess = ""; }, 4000);
      } else if (result.type === "failure") {
        systemError = result.data?.error || "Failed to add entitlement.";
      } else if (result.type === "error") {
        systemError = result.error?.message || "An unexpected error occurred.";
      }
    };
  }

  function bankEnhance() {
    bankSuccess = "";
    bankError = "";
    return async ({ result }: any) => {
      if (result.type === "success") {
        const roleName = bankSelectedRole;
        bankSelectedRole = "";
        await invalidateAll();
        bankSuccess = `Added "${roleName}" successfully.`;
        setTimeout(() => { bankSuccess = ""; }, 4000);
      } else if (result.type === "failure") {
        bankError = result.data?.error || "Failed to add entitlement.";
      } else if (result.type === "error") {
        bankError = result.error?.message || "An unexpected error occurred.";
      }
    };
  }

  // Consumer scopes from the current application
  let consumerScopes = $derived(data.consumerScopes);

  // Categorisation helpers
  function isDynamicEntityRole(name: string) {
    return name.includes("DynamicEntity");
  }
  // Split user's existing entitlements into categories
  let allSystemEntitlements = $derived(
    userEntitlements.filter((e: any) => !e.bank_id),
  );

  let systemEntitlements = $derived(
    allSystemEntitlements.filter((e: any) => !isDynamicEntityRole(e.role_name)),
  );

  let dynamicEntityEntitlements = $derived(
    allSystemEntitlements.filter((e: any) => isDynamicEntityRole(e.role_name)),
  );

  let bankEntitlements = $derived(
    userEntitlements.filter(
      (e: any) => e.bank_id && e.bank_id === currentBank.bankId,
    ),
  );

  let otherBankEntitlementCount = $derived(
    userEntitlements.filter(
      (e: any) => e.bank_id && e.bank_id !== currentBank.bankId,
    ).length,
  );
</script>

<div class="columns-grid mb-6">
  <!-- System-wide Roles Column -->
  <div class="section">
    <!-- Collapsible Add System Entitlement Widget -->
    <div class="widget-wrapper">
      <button
        type="button"
        class="widget-toggle"
        onclick={() => systemExpanded = !systemExpanded}
      >
        <span class="widget-toggle-icon" class:expanded={systemExpanded}>
          {#if systemExpanded}
            <ChevronDown size={14} />
          {:else}
            <Plus size={14} />
          {/if}
        </span>
        <span>Add System Entitlement</span>
      </button>

      {#if systemSuccess}
        <div class="widget-success">{systemSuccess}</div>
      {/if}
      {#if systemError}
        <div class="widget-error">{systemError}</div>
      {/if}

      {#if systemExpanded}
        <div class="widget-content">
          {#if canCreateEntitlements}
            <form method="POST" action="?/create" class="widget-form" use:enhance={systemEnhance}>
              <input type="hidden" name="entitlement" value={systemSelectedRole} />
              <RoleSearchWidget
                roles={systemRoles}
                bind:selectedRole={systemSelectedRole}
              />
              {#if alreadyHasSystemRole}
                <p class="already-has-role mt-3">You already have this entitlement.</p>
              {:else}
                <button class="btn-add-entitlement mt-3" type="submit" disabled={!systemSelectedRole}>
                  Add Entitlement
                </button>
              {/if}
            </form>
          {:else}
            <div class="missing-roles-info">
              <p class="missing-roles-title">You need one of these roles to add system entitlements:</p>
              <ul class="missing-roles-list">
                {#each systemRequiredRoles as role}
                  <li class="missing-role-item" class:has-role={userRoleNames.has(role)}>
                    {#if userRoleNames.has(role)}
                      <Check size={14} class="role-check-icon" />
                      <span class="role-has">{role}</span>
                    {:else}
                      <X size={14} class="role-missing-icon" />
                      <span class="role-missing">{role}</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <div class="section-header">
      <Globe size={18} />
      <h3 class="section-title">System-wide Roles</h3>
      <span class="section-count">{systemEntitlements.length}</span>
    </div>

    {#if systemEntitlements.length > 0}
      <ul class="role-list">
        {#each systemEntitlements as row}
          <li class="role-item">
            <span class="role-name">{row.role_name}</span>
            <button
              class="copy-btn"
              onclick={() =>
                copyToClipboard(row.role_name, row.entitlement_id, row.bank_id, row.entitlement_id)}
              title="Copy entitlement details"
            >
              {#if copiedId === row.entitlement_id}
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              {:else}
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty-text">No system-wide roles</p>
    {/if}
  </div>

  <!-- Bank-level Roles Column -->
  <div class="section">
    <!-- Collapsible Add Bank Entitlement Widget -->
    <div class="widget-wrapper">
      <button
        type="button"
        class="widget-toggle"
        onclick={() => bankExpanded = !bankExpanded}
      >
        <span class="widget-toggle-icon" class:expanded={bankExpanded}>
          {#if bankExpanded}
            <ChevronDown size={14} />
          {:else}
            <Plus size={14} />
          {/if}
        </span>
        <span>Add Bank Entitlement</span>
      </button>

      {#if bankSuccess}
        <div class="widget-success">{bankSuccess}</div>
      {/if}
      {#if bankError}
        <div class="widget-error">{bankError}</div>
      {/if}

      {#if bankExpanded}
        <div class="widget-content">
          {#if canCreateEntitlements}
            <form method="POST" action="?/create" class="widget-form" use:enhance={bankEnhance}>
              <input type="hidden" name="entitlement" value={bankSelectedRole} />
              <input type="hidden" name="bank_id" value={currentBank.bankId} />
              <RoleSearchWidget
                roles={bankRoles}
                bind:selectedRole={bankSelectedRole}
                bankId={currentBank.bankId}
              />
              <div class="scope-info mt-3">
                <Building2 size={16} />
                <span>Bank: <strong>{currentBank.bankId || "none selected"}</strong></span>
              </div>
              {#if alreadyHasBankRole}
                <p class="already-has-role mt-3">You already have this entitlement.</p>
              {:else}
                <button class="btn-add-entitlement mt-3" type="submit" disabled={!bankSelectedRole}>
                  Add Entitlement
                </button>
              {/if}
            </form>
          {:else}
            <div class="missing-roles-info">
              <p class="missing-roles-title">You need one of these roles to add bank entitlements:</p>
              <ul class="missing-roles-list">
                {#each bankRequiredRoles as role}
                  <li class="missing-role-item" class:has-role={userRoleNames.has(role)}>
                    {#if userRoleNames.has(role)}
                      <Check size={14} class="role-check-icon" />
                      <span class="role-has">{role}</span>
                    {:else}
                      <X size={14} class="role-missing-icon" />
                      <span class="role-missing">{role}</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <div class="section-header">
      <Building2 size={18} />
      <h3 class="section-title">Bank Roles: {currentBank.bankId || "—"}</h3>
      <span class="section-count">{bankEntitlements.length}</span>
    </div>

    {#if bankEntitlements.length > 0}
      <ul class="role-list">
        {#each bankEntitlements as row}
          <li class="role-item">
            <span class="role-name">{row.role_name}</span>
            <button
              class="copy-btn"
              onclick={() =>
                copyToClipboard(row.role_name, row.entitlement_id, row.bank_id, row.entitlement_id)}
              title="Copy entitlement details"
            >
              {#if copiedId === row.entitlement_id}
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              {:else}
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty-text">No bank-level roles for this bank</p>
    {/if}
    {#if otherBankEntitlementCount > 0}
      <p class="other-banks-note">
        +{otherBankEntitlementCount} role{otherBankEntitlementCount === 1 ? "" : "s"} at other banks (switch bank to view)
      </p>
    {/if}
  </div>
</div>

<!-- Dynamic Entity Roles -->
<div class="section mb-6">
    <div class="section-header">
      <Box size={18} />
      <h3 class="section-title">Dynamic Entity Roles</h3>
      <span class="section-count">{dynamicEntityEntitlements.length}</span>
    </div>

    {#if dynamicEntityEntitlements.length > 0}
      <ul class="role-list">
        {#each dynamicEntityEntitlements as row}
          <li class="role-item">
            <span class="role-name">{row.role_name}</span>
            <button
              class="copy-btn"
              onclick={() =>
                copyToClipboard(row.role_name, row.entitlement_id, row.bank_id, row.entitlement_id)}
              title="Copy entitlement details"
            >
              {#if copiedId === row.entitlement_id}
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              {:else}
                <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty-text">No dynamic entity roles</p>
    {/if}
</div>

<!-- Consumer Scopes -->
<div class="section mb-6">
  <div class="section-header">
    <AppWindow size={18} />
    <h3 class="section-title">This Consumer Has Scopes{consumerScopes?.app_name ? `: ${consumerScopes.app_name}` : ""}</h3>
    <span class="section-count">{consumerScopes?.scopes?.length ?? 0}</span>
  </div>

  {#if consumerScopes?.scopes && consumerScopes.scopes.length > 0}
    <ul class="role-list">
      {#each consumerScopes.scopes as scope}
        <li class="role-item">
          <span class="role-name">{scope.role_name}</span>
          {#if scope.bank_id}
            <span class="scope-bank-badge">{scope.bank_id}</span>
          {:else}
            <span class="scope-bank-badge scope-bank-badge--system">System</span>
          {/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="empty-text">No scopes assigned to the current application</p>
  {/if}
</div>

<style>
  .columns-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    align-items: start;
  }

  @media (max-width: 768px) {
    .columns-grid {
      grid-template-columns: 1fr;
    }
  }

  .section {
    background: var(--ui-card);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--ui-border);
  }

  .section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0;
  }

  .section-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.25rem;
    background: var(--ui-panel);
    color: var(--ui-muted);
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 600;
  }

  /* Widget toggle and content */
  .widget-wrapper {
    border-bottom: 1px solid var(--ui-border);
    margin-bottom: 0.75rem;
  }

  .widget-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 1rem;
    background: var(--ui-tone-success-bg);
    border: none;
    border-left: 3px solid var(--ui-tone-success-border);
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--ui-tone-success-text);
    text-align: left;
    transition: background 0.2s;
  }

  .widget-toggle:hover {
    background: var(--ui-tone-success-bg);
  }

  .widget-toggle-icon {
    display: flex;
    align-items: center;
    transition: transform 0.2s;
  }

  .widget-content {
    padding: 1rem;
    background: var(--ui-tone-success-bg);
    animation: slideDown 0.2s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .widget-form {
    display: flex;
    flex-direction: column;
  }

  .btn-add-entitlement {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1.25rem;
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    align-self: flex-start;
  }

  .btn-add-entitlement:hover:not(:disabled) {
    background: var(--ui-tone-success-bg);
    color: var(--ui-tone-success-text);
  }

  .btn-add-entitlement:disabled {
    background: var(--ui-panel);
    color: var(--ui-muted);
    cursor: not-allowed;
  }

  .widget-success {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--ui-tone-success-text);
    background: var(--ui-tone-success-bg);
    border: 1px solid var(--ui-tone-success-border);
    border-radius: 0;
    padding: 0.5rem 1rem;
  }

  .widget-error {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--ui-tone-error-text);
    background: var(--ui-tone-error-bg);
    border: 1px solid var(--ui-tone-error-border);
    border-left: 3px solid var(--ui-tone-error-border);
    border-radius: 0;
    padding: 0.5rem 1rem;
  }

  .already-has-role {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--ui-tone-warning-text);
    background: var(--ui-tone-warning-bg);
    border: 1px solid var(--ui-tone-warning-border);
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
  }

  /* Missing roles info */
  .missing-roles-info {
    padding: 0.5rem;
  }

  .missing-roles-title {
    font-size: 0.8rem;
    color: var(--ui-muted);
    margin: 0 0 0.5rem 0;
  }

  .missing-roles-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .missing-role-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    padding: 0.375rem 0.5rem;
    border-radius: 4px;
  }

  .missing-role-item.has-role {
    background: var(--ui-tone-success-bg);
  }

  .missing-role-item :global(.role-check-icon) {
    color: var(--ui-success);
    flex-shrink: 0;
  }

  .missing-role-item :global(.role-missing-icon) {
    color: var(--ui-error);
    flex-shrink: 0;
  }

  .role-has {
    color: var(--ui-success);
    text-decoration: line-through;
    opacity: 0.7;
  }

  .role-missing {
    color: var(--ui-error);
    font-weight: 600;
  }

  /* Existing styles */
  .role-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .role-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--ui-border);
  }

  .role-item:last-child {
    border-bottom: none;
  }

  .role-name {
    font-size: 0.8rem;
    color: var(--ui-text);
  }

  .copy-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    color: var(--ui-muted);
    background: none;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: color 0.2s;
  }

  .copy-btn:hover {
    color: var(--ui-text);
  }

  .empty-text {
    padding: 1.5rem;
    text-align: center;
    color: var(--ui-muted);
    font-size: 0.8rem;
  }

  .other-banks-note {
    padding: 0.5rem 1rem;
    font-size: 0.75rem;
    color: var(--ui-muted);
    border-top: 1px solid var(--ui-border);
  }

  .scope-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--ui-tone-info-bg);
    border: 1px solid var(--ui-tone-info-border);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--ui-tone-info-text);
  }

  .scope-bank-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 500;
  }

  .scope-bank-badge--system {
    background: var(--ui-tone-accent-bg);
    color: var(--ui-tone-accent-text);
  }
</style>
