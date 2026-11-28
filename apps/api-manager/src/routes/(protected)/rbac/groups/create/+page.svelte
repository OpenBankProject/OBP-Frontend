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
  import { goto } from "$app/navigation";
  import {
    Users,
    ArrowLeft,
    Shield,
    ChevronRight,
    X,
  } from "@lucide/svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import RoleSearchWidget from "$lib/components/RoleSearchWidget.svelte";
  import { currentBank } from "$lib/stores/currentBank.svelte";

  let { data } = $props<{ data: PageData }>();

  let roles = $derived(data.roles || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  // Form state
  let bankId = $state(currentBank.bankId);
  let groupName = $state("");

  $effect(() => {
    bankId = currentBank.bankId;
  });
  let groupDescription = $state("");
  let selectedRoles = $state<string[]>([]);
  let isEnabled = $state(true);
  let isSubmitting = $state(false);

  // Role selection state
  let currentSelectedRole = $state("");
  let currentRoleScope = $state<"all" | "system" | "bank">("all");

  // Add selected role to the group
  function addRole() {
    if (currentSelectedRole && !selectedRoles.includes(currentSelectedRole)) {
      selectedRoles = [...selectedRoles, currentSelectedRole];
      currentSelectedRole = "";
    }
  }

  // Remove role from the group
  function removeRole(role: string) {
    selectedRoles = selectedRoles.filter((r) => r !== role);
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!groupName.trim()) {
      toast.error("Validation Error", "Group name is required");
      return;
    }

    if (!groupDescription.trim()) {
      toast.error("Validation Error", "Group description is required");
      return;
    }

    if (selectedRoles.length === 0) {
      toast.error("Validation Error", "At least one role is required");
      return;
    }

    isSubmitting = true;

    try {
      const requestBody: any = {
        group_name: groupName.trim(),
        group_description: groupDescription.trim(),
        list_of_roles: selectedRoles,
        is_enabled: isEnabled,
      };

      // Only include bank_id if it's provided
      if (bankId && bankId.trim() !== "") {
        requestBody.bank_id = bankId.trim();
      }

      const response = await trackedFetch("/backend/rbac/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      toast.success("Group Created", `Successfully created group ${groupName}`);

      // Redirect to groups list after short delay
      setTimeout(() => {
        goto("/rbac/groups");
      }, 1000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create group";
      toast.error("Error", errorMessage);
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    goto("/rbac/groups");
  }
</script>

<svelte:head>
  <title>Create Group - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Breadcrumb Navigation -->
  <nav class="breadcrumb mb-6">
    <a href="/rbac/groups" class="breadcrumb-link">Groups</a>
    <span class="breadcrumb-separator">›</span>
    <span class="breadcrumb-current">Create Group</span>
  </nav>

  <div class="panel">
    <div class="panel-header">
      <div class="header-content">
        <div class="header-icon">
          <Users size={32} />
        </div>
        <div>
          <h1 class="panel-title">Create Group</h1>
          <div class="panel-subtitle">
            Create a new user group for managing access control
          </div>
        </div>
      </div>
    </div>

    <div class="panel-content">
      {#if error && !hasApiAccess}
        <div class="error-message">
          <p>⚠️ {error}</p>
        </div>
      {/if}

      <form onsubmit={handleSubmit} class="form">
        <!-- Group Name -->
        <div class="form-group">
          <label for="group-name" class="form-label">
            <Users size={16} />
            Group Name
            <span class="required">*</span>
          </label>
          <input
            id="group-name"
            type="text"
            class="form-input"
            placeholder="e.g., Teller Group"
            bind:value={groupName}
            disabled={isSubmitting}
            required
          />
          <div class="form-help">A unique name to identify this group</div>
        </div>

        <!-- Group Description -->
        <div class="form-group">
          <label for="group-description" class="form-label">
            Description
            <span class="required">*</span>
          </label>
          <textarea
            id="group-description"
            class="form-textarea"
            placeholder="e.g., Standard teller roles for branch operations"
            bind:value={groupDescription}
            disabled={isSubmitting}
            rows="4"
            required
          ></textarea>
          <div class="form-help">
            Describe the purpose and members of this group
          </div>
        </div>

        <!-- Roles Transfer List -->
        <div class="form-group">
          <label class="form-label">
            <Shield size={16} />
            Roles
            <span class="required">*</span>
          </label>
          <div class="form-help">
            Select roles from the left panel and add them to the group
          </div>

          <div class="transfer-list">
            <!-- Left Panel: Available Roles -->
            <div class="transfer-panel">
              <div class="transfer-panel-header">
                <h3 class="transfer-panel-title">Available Roles</h3>
              </div>
              <div class="transfer-panel-content">
                {#if hasApiAccess && roles.length > 0}
                  <RoleSearchWidget
                    {roles}
                    bind:selectedRole={currentSelectedRole}
                    bind:roleScope={currentRoleScope}
                    disabled={isSubmitting}
                  />
                {:else if !hasApiAccess}
                  <div class="empty-state">
                    <p>No API access available</p>
                  </div>
                {:else}
                  <div class="empty-state">
                    <p>No roles available</p>
                  </div>
                {/if}
              </div>
            </div>

            <!-- Middle: Transfer Button -->
            <div class="transfer-arrow">
              <button
                type="button"
                class="btn-transfer"
                onclick={addRole}
                disabled={!currentSelectedRole || isSubmitting}
                title="Add selected role to group"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <!-- Right Panel: Selected Roles -->
            <div class="transfer-panel">
              <div class="transfer-panel-header">
                <h3 class="transfer-panel-title">
                  Group Roles ({selectedRoles.length})
                </h3>
              </div>
              <div class="transfer-panel-content">
                {#if selectedRoles.length === 0}
                  <div class="empty-state">
                    <Shield size={32} />
                    <p>No roles added yet</p>
                    <p class="empty-state-hint">
                      Select a role from the left and click the arrow to add it
                    </p>
                  </div>
                {:else}
                  <div class="selected-roles-list">
                    {#each selectedRoles as role}
                      <div class="selected-role-item">
                        <span class="selected-role-name">{role}</span>
                        <button
                          type="button"
                          class="btn-remove"
                          onclick={() => removeRole(role)}
                          disabled={isSubmitting}
                          title="Remove role"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>

        <!-- Is Enabled (hidden, always true) -->

        <!-- Action Buttons -->
        <div class="form-actions">
          <button
            type="button"
            class="btn-secondary"
            onclick={handleCancel}
            disabled={isSubmitting}
          >
            <ArrowLeft size={16} />
            Cancel
          </button>
          <button type="submit" class="btn-primary" disabled={isSubmitting}>
            {#if isSubmitting}
              ⏳ Creating...
            {:else}
              <Users size={16} />
              Create Group
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
    padding: 2rem;
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
    width: 64px;
    height: 64px;
    background: var(--ui-tone-info-bg);
    color: var(--ui-tone-info-text);
    border-radius: 12px;
    flex-shrink: 0;
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

  .panel-content {
    padding: 2rem;
  }

  .error-message {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--ui-tone-error-bg);
    border: 1px solid var(--ui-tone-error-border);
    border-radius: 6px;
    color: var(--ui-tone-error-text);
    font-size: 0.875rem;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ui-text);
  }

  .required {
    color: var(--ui-error);
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: var(--ui-link);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-link) 10%, transparent);
  }

  .form-input:disabled,
  .form-textarea:disabled {
    background: var(--ui-card);
    cursor: not-allowed;
    opacity: 0.6;
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
  }

  .form-help {
    font-size: 0.75rem;
    color: var(--ui-muted);
  }

  /* Transfer List Styles */
  .transfer-list {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 1rem;
    margin-top: 0.75rem;
  }

  .transfer-panel {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    background: var(--ui-card);
    overflow: hidden;
  }

  .transfer-panel-header {
    padding: 0.75rem 1rem;
    background: var(--ui-panel);
    border-bottom: 1px solid var(--ui-border);
  }

  .transfer-panel-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--ui-text);
    margin: 0;
  }

  .transfer-panel-content {
    padding: 1rem;
    min-height: 400px;
    max-height: 500px;
    overflow-y: auto;
  }

  .transfer-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-transfer {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: var(--ui-fill-main-bg);
    color: var(--ui-fill-main-text);
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .btn-transfer:hover:not(:disabled) {
    opacity: 0.85;
    transform: scale(1.05);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .btn-transfer:disabled {
    background: var(--ui-panel);
    cursor: not-allowed;
    opacity: 0.5;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    text-align: center;
    color: var(--ui-muted);
    min-height: 300px;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  .empty-state-hint {
    font-size: 0.75rem !important;
    color: var(--ui-muted) !important;
  }

  .selected-roles-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .selected-role-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--ui-hover);
    border: 1px solid var(--ui-border);
    border-radius: 6px;
    transition: all 0.2s;
  }

  .selected-role-item:hover {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .selected-role-name {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--ui-text);
  }

  .btn-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--ui-tone-error-bg);
    color: var(--ui-tone-error-text);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .btn-remove:hover:not(:disabled) {
    background: var(--ui-tone-error-bg);
  }

  .btn-remove:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid var(--ui-border);
  }

  .btn-primary,
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--ui-fill-main-bg);
    color: var(--ui-fill-main-text);
  }

  .btn-primary:hover:not(:disabled) {
    opacity: 0.85;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: var(--ui-panel);
    color: var(--ui-text);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--ui-hover);
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Responsive Design */
  @media (max-width: 1024px) {
    .transfer-list {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .transfer-arrow {
      order: 2;
    }

    .btn-transfer {
      transform: rotate(90deg);
      width: 40px;
      height: 40px;
    }

    .transfer-panel:first-child {
      order: 1;
    }

    .transfer-panel:last-child {
      order: 3;
    }
  }

  @media (max-width: 640px) {
    .form-actions {
      flex-direction: column-reverse;
    }

    .btn-primary,
    .btn-secondary {
      width: 100%;
      justify-content: center;
    }

    .header-content {
      flex-direction: column;
      text-align: center;
    }

    .transfer-panel-content {
      min-height: 300px;
    }
  }
</style>
