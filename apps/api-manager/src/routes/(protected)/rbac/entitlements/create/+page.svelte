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
  import { page } from "$app/stores";
  import { onDestroy } from "svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import UserSearchPickerWidget from "$lib/components/UserSearchPickerWidget.svelte";
  import RoleSearchWidget from "$lib/components/RoleSearchWidget.svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";
  import type { PageData } from "./$types";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";

  let { data } = $props<{ data: PageData }>();

  let roles = $derived(data.roles || []);

  // Read URL parameters
  const urlUsername = $page.url.searchParams.get("username") || "";
  const urlRole = $page.url.searchParams.get("role") || "";

  // Form state
  let userId = $state("");
  let username = $state(urlUsername);
  let roleName = $state(urlRole);
  let roleScope = $state<"all" | "system" | "bank">("all");
  let bankId = $state(currentBank.bankId);
  let roleSearchQuery = $state("");
  let isSubmitting = $state(false);
  let formError = $state("");
  let errorTimer: ReturnType<typeof setTimeout> | null = null;

  function setFormError(message: string) {
    if (errorTimer) clearTimeout(errorTimer);
    formError = message;
    if (message) {
      errorTimer = setTimeout(() => { formError = ""; }, 5000);
    }
  }

  onDestroy(() => {
    if (errorTimer) clearTimeout(errorTimer);
  });

  // Clear error when user changes form inputs
  $effect(() => {
    roleName; userId; bankId;
    setFormError("");
  });

  // Determine if selected role requires bank_id
  let selectedRoleRequiresBank = $derived.by(() => {
    if (roleName) {
      const role = roles.find((r: any) => r.role === roleName);
      if (role) return role.requires_bank_id;
    }
    // When no role selected yet, use scope as hint
    return roleScope === "bank";
  });

  // Sync bankId based on whether the role needs a bank
  $effect(() => {
    if (selectedRoleRequiresBank) {
      bankId = currentBank.bankId;
    } else {
      bankId = "";
    }
  });

  function handleUserSelect(user: any) {
    userId = user.user_id;
    username = user.username;
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!userId.trim()) {
      setFormError(
        "No user selected. Type a username, email, or user ID, then click a result from the dropdown to select it.",
      );
      return;
    }

    if (!roleName) {
      setFormError("No role selected. Pick a role from the list below.");
      return;
    }

    isSubmitting = true;
    setFormError("");

    try {
      const response = await trackedFetch("/backend/rbac/entitlements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId.trim(),
          role_name: roleName,
          bank_id: bankId.trim() || "",
        }),
      });

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to create entitlement",
        );
        logErrorDetails("Create Entitlement", errorDetails);
        setFormError(formatErrorForDisplay(errorDetails));
        return;
      }

      toast.success(
        "Entitlement Created",
        `Successfully granted ${roleName} to user ${userId}`,
      );
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to create entitlement",
      );
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    goto("/rbac/entitlements");
  }
</script>

<svelte:head>
  <title>Create Entitlement - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb -->
  <nav class="breadcrumb mb-6">
    <a href="/rbac/entitlements" class="breadcrumb-link">Entitlements</a>
    <span class="breadcrumb-separator">/</span>
    <span class="breadcrumb-current">Create</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <h1 class="panel-title">Create Entitlement</h1>
    </div>

    <div class="panel-content">
      <form onsubmit={handleSubmit} class="form">
        <div class="search-row">
          <UserSearchPickerWidget
            onSelect={handleUserSelect}
            bind:selectedUserId={userId}
            bind:selectedUsername={username}
            disabled={isSubmitting}
            initialUsername={urlUsername}
          />
          <div class="role-search-input">
            <input
              type="text"
              class="search-input"
              placeholder="Search roles..."
              bind:value={roleSearchQuery}
              disabled={isSubmitting}
            />
          </div>
        </div>

        <RoleSearchWidget
          {roles}
          bind:selectedRole={roleName}
          bind:roleScope
          bind:searchQuery={roleSearchQuery}
          {bankId}
          hideSearch
          disabled={isSubmitting}
        />

        {#if formError}
          <div class="form-error" data-testid="form-error">
            {formError}
          </div>
        {/if}

        <div class="form-actions">
          <button
            type="button"
            class="btn-secondary"
            onclick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button type="submit" class="btn-primary" disabled={isSubmitting}>
            {#if isSubmitting}
              <span class="spinner">⏳</span>
              Creating...
            {:else}
              Create Entitlement
            {/if}
          </button>
        </div>
      </form>
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
    font-size: 0.875rem;
  }

  .breadcrumb-link {
    color: #667eea;
    text-decoration: none;
    transition: color 0.2s;
  }

  .breadcrumb-link:hover {
    color: #5568d3;
    text-decoration: underline;
  }

  :global([data-mode="dark"]) .breadcrumb-link {
    color: rgb(var(--color-primary-400));
  }

  .breadcrumb-separator {
    color: #9ca3af;
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
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .panel-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-content {
    padding: 1.25rem;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .search-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
  }

  .role-search-input {
    flex: 0 0 480px;
  }

  .search-input {
    width: 100%;
    padding: 0.625rem 0.75rem;
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

  .search-input:disabled {
    background: #f9fafb;
    cursor: not-allowed;
    opacity: 0.6;
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

  .form-error {
    padding: 0.75rem 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #991b1b;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  :global([data-mode="dark"]) .form-error {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .form-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding-top: 0.75rem;
    border-top: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .form-actions {
    border-top-color: rgb(var(--color-surface-700));
  }

  .btn-secondary,
  .btn-primary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1.25rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f9fafb;
  }

  :global([data-mode="dark"]) .btn-secondary {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
    border-color: rgb(var(--color-surface-600));
  }

  :global([data-mode="dark"]) .btn-secondary:hover:not(:disabled) {
    background: rgb(var(--color-surface-600));
  }

  .btn-primary {
    background: #51b265;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #3d9e52;
  }

  :global([data-mode="dark"]) .btn-primary {
    background: #51b265;
  }

  :global([data-mode="dark"]) .btn-primary:hover:not(:disabled) {
    background: #3d9e52;
  }

  .btn-secondary:disabled,
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .spinner {
    display: inline-block;
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

  @media (max-width: 768px) {
    .search-row {
      flex-direction: column;
    }

    .form-actions {
      flex-direction: column-reverse;
    }

    .btn-secondary,
    .btn-primary {
      width: 100%;
      justify-content: center;
    }
  }
</style>
