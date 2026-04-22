<script lang="ts">
  import type { PageData } from "./$types";
  import { goto } from "$app/navigation";
  import {
    Users,
    ArrowLeft,
    Shield,
    ChevronRight,
    X,
    Save,
  } from "@lucide/svelte";
  import { toast } from "$lib/utils/toastService";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import RoleSearchWidget from "$lib/components/RoleSearchWidget.svelte";

  let { data } = $props<{ data: PageData }>();

  let group = $derived(data.group);
  let roles = $derived(data.roles || []);
  let hasApiAccess = $derived(data.hasApiAccess);
  let error = $derived(data.error);

  let bankId = $state(group?.bank_id ?? "");
  let groupName = $state(group?.group_name ?? "");
  let groupDescription = $state(group?.group_description ?? "");
  let selectedRoles = $state<string[]>([...(group?.list_of_roles ?? [])]);
  let isEnabled = $state(group?.is_enabled ?? true);
  let isSubmitting = $state(false);

  let currentSelectedRole = $state("");
  let currentRoleScope = $state<"all" | "system" | "bank">("all");

  function addRole() {
    if (currentSelectedRole && !selectedRoles.includes(currentSelectedRole)) {
      selectedRoles = [...selectedRoles, currentSelectedRole];
      currentSelectedRole = "";
    }
  }

  function removeRole(role: string) {
    selectedRoles = selectedRoles.filter((r) => r !== role);
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!group) return;

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
      const requestBody: Record<string, unknown> = {
        group_name: groupName.trim(),
        group_description: groupDescription.trim(),
        list_of_roles: selectedRoles,
        is_enabled: isEnabled,
      };

      if (bankId && bankId.trim() !== "") {
        requestBody.bank_id = bankId.trim();
      }

      const response = await trackedFetch(
        `/proxy/obp/v6.0.0/management/groups/${group.group_id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      toast.success("Group Updated", `Successfully updated group ${groupName}`);

      setTimeout(() => {
        goto(`/rbac/groups/${group.group_id}`);
      }, 1000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to update group";
      toast.error("Error", errorMessage);
    } finally {
      isSubmitting = false;
    }
  }

  function handleCancel() {
    if (group) {
      goto(`/rbac/groups/${group.group_id}`);
    } else {
      goto("/rbac/groups");
    }
  }
</script>

<svelte:head>
  <title>Edit Group - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <nav class="breadcrumb mb-6">
    <a href="/rbac/groups" class="breadcrumb-link">Groups</a>
    <span class="breadcrumb-separator">›</span>
    {#if group}
      <a href="/rbac/groups/{group.group_id}" class="breadcrumb-link">
        {group.group_name}
      </a>
      <span class="breadcrumb-separator">›</span>
    {/if}
    <span class="breadcrumb-current">Edit</span>
  </nav>

  {#if error && !hasApiAccess}
    <div class="error-message">
      <p>⚠️ {error}</p>
    </div>
  {:else if !group}
    <div class="error-message">
      <p>⚠️ Group not found</p>
    </div>
  {:else}
    <div class="panel">
      <div class="panel-header">
        <div class="header-content">
          <div class="header-icon">
            <Users size={32} />
          </div>
          <div>
            <h1 class="panel-title">Edit Group</h1>
            <div class="panel-subtitle">
              Update the group details, roles and status
            </div>
          </div>
        </div>
      </div>

      <div class="panel-content">
        <form onsubmit={handleSubmit} class="form" data-testid="edit-group-form">
          <div class="form-group">
            <label for="group-id" class="form-label">Group ID</label>
            <input
              id="group-id"
              name="group_id"
              type="text"
              class="form-input"
              value={group.group_id}
              disabled
              readonly
              data-testid="edit-group-id"
            />
          </div>

          <div class="form-group">
            <label for="bank-id" class="form-label">Bank ID</label>
            <input
              id="bank-id"
              name="bank_id"
              type="text"
              class="form-input"
              placeholder="Leave empty for system-wide group"
              bind:value={bankId}
              disabled={isSubmitting}
              data-testid="edit-group-bank-id"
            />
            <div class="form-help">Leave empty for a system-wide group</div>
          </div>

          <div class="form-group">
            <label for="group-name" class="form-label">
              <Users size={16} />
              Group Name
              <span class="required">*</span>
            </label>
            <input
              id="group-name"
              name="group_name"
              type="text"
              class="form-input"
              bind:value={groupName}
              disabled={isSubmitting}
              required
              data-testid="edit-group-name"
            />
          </div>

          <div class="form-group">
            <label for="group-description" class="form-label">
              Description
              <span class="required">*</span>
            </label>
            <textarea
              id="group-description"
              name="group_description"
              class="form-textarea"
              bind:value={groupDescription}
              disabled={isSubmitting}
              rows="4"
              required
              data-testid="edit-group-description"
            ></textarea>
          </div>

          <div class="form-group">
            <label class="form-label" for="is-enabled">
              <input
                id="is-enabled"
                name="is_enabled"
                type="checkbox"
                bind:checked={isEnabled}
                disabled={isSubmitting}
                data-testid="edit-group-is-enabled"
              />
              Enabled
            </label>
          </div>

          <div class="form-group">
            <span class="form-label">
              <Shield size={16} />
              Roles
              <span class="required">*</span>
            </span>
            <div class="form-help">
              Select roles from the left panel and add them to the group
            </div>

            <div class="transfer-list">
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

              <div class="transfer-arrow">
                <button
                  type="button"
                  class="btn-transfer"
                  onclick={addRole}
                  disabled={!currentSelectedRole || isSubmitting}
                  data-testid="edit-group-add-role"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

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
                    </div>
                  {:else}
                    <div
                      class="selected-roles-list"
                      data-testid="edit-group-selected-roles"
                    >
                      {#each selectedRoles as role}
                        <div
                          class="selected-role-item"
                          data-testid="edit-group-role-{role}"
                        >
                          <span class="selected-role-name">{role}</span>
                          <button
                            type="button"
                            class="btn-remove"
                            onclick={() => removeRole(role)}
                            disabled={isSubmitting}
                            data-testid="edit-group-remove-role-{role}"
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

          <div class="form-actions">
            <button
              type="button"
              class="btn-secondary"
              onclick={handleCancel}
              disabled={isSubmitting}
              data-testid="edit-group-cancel"
            >
              <ArrowLeft size={16} />
              Cancel
            </button>
            <button
              type="submit"
              class="btn-primary"
              disabled={isSubmitting}
              data-testid="edit-group-submit"
            >
              {#if isSubmitting}
                ⏳ Saving...
              {:else}
                <Save size={16} />
                Save Changes
              {/if}
            </button>
          </div>
        </form>
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

  .error-message {
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    color: #991b1b;
    font-size: 0.875rem;
  }

  :global([data-mode="dark"]) .error-message {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
    color: rgb(var(--color-error-200));
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
    padding: 2rem;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .panel-header {
    border-bottom-color: rgb(var(--color-surface-700));
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
    background: #eff6ff;
    color: #3b82f6;
    border-radius: 12px;
    flex-shrink: 0;
  }

  :global([data-mode="dark"]) .header-icon {
    background: rgba(59, 130, 246, 0.2);
    color: rgb(var(--color-primary-400));
  }

  .panel-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  :global([data-mode="dark"]) .panel-title {
    color: var(--color-surface-100);
  }

  .panel-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  :global([data-mode="dark"]) .panel-subtitle {
    color: var(--color-surface-400);
  }

  .panel-content {
    padding: 2rem;
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
    color: #374151;
  }

  :global([data-mode="dark"]) .form-label {
    color: var(--color-surface-200);
  }

  .required {
    color: #dc2626;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .form-input:disabled,
  .form-textarea:disabled {
    background: #f9fafb;
    cursor: not-allowed;
    opacity: 0.6;
  }

  :global([data-mode="dark"]) .form-input,
  :global([data-mode="dark"]) .form-textarea {
    background: rgb(var(--color-surface-700));
    border-color: rgb(var(--color-surface-600));
    color: var(--color-surface-100);
  }

  :global([data-mode="dark"]) .form-input:focus,
  :global([data-mode="dark"]) .form-textarea:focus {
    border-color: rgb(var(--color-primary-500));
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
  }

  :global([data-mode="dark"]) .form-input:disabled,
  :global([data-mode="dark"]) .form-textarea:disabled {
    background: rgb(var(--color-surface-800));
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
  }

  .form-help {
    font-size: 0.75rem;
    color: #6b7280;
  }

  :global([data-mode="dark"]) .form-help {
    color: var(--color-surface-400);
  }

  .transfer-list {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 1rem;
    margin-top: 0.75rem;
  }

  .transfer-panel {
    display: flex;
    flex-direction: column;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #fafafa;
    overflow: hidden;
  }

  :global([data-mode="dark"]) .transfer-panel {
    background: rgb(var(--color-surface-900));
    border-color: rgb(var(--color-surface-700));
  }

  .transfer-panel-header {
    padding: 0.75rem 1rem;
    background: #f3f4f6;
    border-bottom: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .transfer-panel-header {
    background: rgb(var(--color-surface-800));
    border-bottom-color: rgb(var(--color-surface-700));
  }

  .transfer-panel-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin: 0;
  }

  :global([data-mode="dark"]) .transfer-panel-title {
    color: var(--color-surface-200);
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
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .btn-transfer:hover:not(:disabled) {
    background: #2563eb;
    transform: scale(1.05);
  }

  .btn-transfer:disabled {
    background: #d1d5db;
    cursor: not-allowed;
    opacity: 0.5;
  }

  :global([data-mode="dark"]) .btn-transfer {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-transfer:hover:not(:disabled) {
    background: rgb(var(--color-primary-700));
  }

  :global([data-mode="dark"]) .btn-transfer:disabled {
    background: rgb(var(--color-surface-700));
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    text-align: center;
    color: #9ca3af;
    min-height: 300px;
  }

  :global([data-mode="dark"]) .empty-state {
    color: var(--color-surface-500);
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
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
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .selected-role-item:hover {
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  :global([data-mode="dark"]) .selected-role-item {
    background: rgb(var(--color-surface-800));
    border-color: rgb(var(--color-surface-700));
  }

  .selected-role-name {
    flex: 1;
    font-size: 0.875rem;
    font-weight: 500;
    color: #111827;
  }

  :global([data-mode="dark"]) .selected-role-name {
    color: var(--color-surface-100);
  }

  .btn-remove {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: #fef2f2;
    color: #dc2626;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .btn-remove:hover:not(:disabled) {
    background: #fee2e2;
  }

  .btn-remove:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-remove {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(var(--color-error-400));
  }

  :global([data-mode="dark"]) .btn-remove:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
    padding-top: 1rem;
    border-top: 1px solid #e5e7eb;
  }

  :global([data-mode="dark"]) .form-actions {
    border-top-color: rgb(var(--color-surface-700));
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
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-primary {
    background: rgb(var(--color-primary-600));
  }

  :global([data-mode="dark"]) .btn-primary:hover:not(:disabled) {
    background: rgb(var(--color-primary-700));
  }

  .btn-secondary {
    background: #f3f4f6;
    color: #374151;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e5e7eb;
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global([data-mode="dark"]) .btn-secondary {
    background: rgb(var(--color-surface-700));
    color: var(--color-surface-200);
  }

  :global([data-mode="dark"]) .btn-secondary:hover:not(:disabled) {
    background: rgb(var(--color-surface-600));
  }

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
