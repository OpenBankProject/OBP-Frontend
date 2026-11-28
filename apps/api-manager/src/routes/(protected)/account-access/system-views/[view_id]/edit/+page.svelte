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
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";

  let { data }: { data: PageData } = $props();

  // Form states - prepopulate with existing view data
  let formName = $state(data.view?.short_name || "");
  let formDescription = $state(data.view?.description || "");
  let formMetadataView = $state(data.view?.metadata_view || "");
  let formIsPublic = $state(data.view?.is_public || false);
  let formWhichAliasToUse = $state(data.view?.alias || "public");
  let formHideMetadataIfAliasUsed = $state(
    data.view?.hide_metadata_if_alias_used || false,
  );
  let formError = $state("");
  let isSubmitting = $state(false);

  // Get view permissions from API data, grouped by category
  let permissionsByCategory = $derived(data.permissionsByCategory || []);

  // Flat list of all permissions (for select/deselect all)
  let allAllowedActions = $derived(
    permissionsByCategory.flatMap((g: any) => g.permissions),
  );

  // Prepopulate with existing allowed actions
  let selectedActions = $state<string[]>(
    (data.view as any)?.allowed_actions || [],
  );
  let grantAccessViews = $state(
    (data.view as any)?.can_grant_access_to_views?.join(", ") || "",
  );
  let revokeAccessViews = $state(
    (data.view as any)?.can_revoke_access_to_views?.join(", ") || "",
  );

  function toggleAction(action: string) {
    if (selectedActions.includes(action)) {
      selectedActions = selectedActions.filter((a) => a !== action);
    } else {
      selectedActions = [...selectedActions, action];
    }
  }

  function selectAllActions() {
    selectedActions = [...allAllowedActions];
  }

  function deselectAllActions() {
    selectedActions = [];
  }

  function selectAllInGroup(permissions: string[]) {
    const toAdd = permissions.filter((a) => !selectedActions.includes(a));
    selectedActions = [...selectedActions, ...toAdd];
  }

  function deselectAllInGroup(permissions: string[]) {
    selectedActions = selectedActions.filter((a) => !permissions.includes(a));
  }

  function countSelectedInGroup(permissions: string[]): number {
    return permissions.filter((a) => selectedActions.includes(a)).length;
  }

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!formName.trim()) {
      formError = "View name is required";
      return;
    }

    if (!formDescription.trim()) {
      formError = "Description is required";
      return;
    }

    isSubmitting = true;
    formError = "";

    try {
      const requestBody: any = {
        name: formName,
        description: formDescription,
        metadata_view: formMetadataView || formDescription,
        is_public: formIsPublic,
        which_alias_to_use: formWhichAliasToUse,
        hide_metadata_if_alias_used: formHideMetadataIfAliasUsed,
        allowed_actions: selectedActions,
      };

      // Add grant/revoke access views if provided
      if (grantAccessViews.trim()) {
        requestBody.can_grant_access_to_views = grantAccessViews
          .split(",")
          .map((v: string) => v.trim())
          .filter((v: string) => v);
      }

      if (revokeAccessViews.trim()) {
        requestBody.can_revoke_access_to_views = revokeAccessViews
          .split(",")
          .map((v: string) => v.trim())
          .filter((v: string) => v);
      }

      const response = await fetch(`/backend/system-views/${data.view?.view_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to update system view",
        );
        logErrorDetails("Update System View", errorDetails);
        const errorMessage = formatErrorForDisplay(errorDetails);

        throw new Error(errorMessage);
      }

      // Success - redirect back to the view detail page
      goto(`/account-access/system-views/${data.view?.view_id}`);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to update system view";
      formError = errorMsg;
      isSubmitting = false;
    }
  }

  function handleCancel() {
    goto(`/account-access/system-views/${data.view?.view_id}`);
  }
</script>

<svelte:head>
  <title>Update System View - API Manager II</title>
</svelte:head>

  <div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-bold ui-text">
        Update System View: {data.view?.short_name}
      </h1>
      <p class="mt-2 text-sm ui-muted">
        Update the system view configuration and permissions
      </p>
    </div>

    <div class="mx-auto max-w-4xl">
      <div
        class="rounded-lg p-6 shadow-md ui-card"
      >
        {#if formError}
          <div
            class="mb-4 rounded-lg border p-4 ui-tone-error"
          >
            <p class="text-sm ui-text-error">{formError}</p>
          </div>
        {/if}

        <form onsubmit={handleSubmit}>
          <div class="space-y-6">
            <!-- Name Field -->
            <div>
              <label
                for="name"
                class="mb-2 block text-sm font-medium ui-muted"
              >
                View Name <span class="ui-text-error">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formName}
                disabled
                class="w-full rounded-lg border px-4 py-2 ui-panel ui-muted ui-border"
              />
              <p class="mt-1 text-xs ui-muted">
                View name cannot be changed
              </p>
            </div>

            <!-- Description Field -->
            <div>
              <label
                for="description"
                class="mb-2 block text-sm font-medium ui-muted"
              >
                Description <span class="ui-text-error">*</span>
              </label>
              <textarea
                id="description"
                bind:value={formDescription}
                required
                rows="3"
                placeholder="Describe the purpose and scope of this view"
                class="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ui-card ui-text ui-border"
              ></textarea>
            </div>

            <!-- Metadata View Field -->
            <div>
              <label
                for="metadata_view"
                class="mb-2 block text-sm font-medium ui-muted"
              >
                Metadata View
              </label>
              <textarea
                id="metadata_view"
                bind:value={formMetadataView}
                rows="2"
                placeholder="Optional metadata description (defaults to description)"
                class="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ui-card ui-text ui-border"
              ></textarea>
            </div>

            <!-- Two Column Layout for Settings -->
            <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
              <!-- Is Public -->
              <div>
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    bind:checked={formIsPublic}
                    class="h-4 w-4 rounded focus:ring-2 ui-link ui-panel ui-border"
                  />
                  <span
                    class="ml-2 text-sm font-medium ui-muted"
                  >
                    Public View
                  </span>
                </label>
                <p class="mt-1 text-xs ui-muted">
                  Accessible to all users
                </p>
              </div>

              <!-- Hide Metadata If Alias Used -->
              <div>
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    bind:checked={formHideMetadataIfAliasUsed}
                    class="h-4 w-4 rounded focus:ring-2 ui-link ui-panel ui-border"
                  />
                  <span
                    class="ml-2 text-sm font-medium ui-muted"
                  >
                    Hide Metadata If Alias Used
                  </span>
                </label>
                <p class="mt-1 text-xs ui-muted">
                  Hide metadata when alias is shown
                </p>
              </div>
            </div>

            <!-- Which Alias to Use -->
            <div>
              <label
                for="alias"
                class="mb-2 block text-sm font-medium ui-muted"
              >
                Which Alias to Use
              </label>
              <select
                id="alias"
                bind:value={formWhichAliasToUse}
                class="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ui-card ui-text ui-border"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="none">None</option>
              </select>
            </div>

            <!-- Grant Access to Views -->
            <div>
              <label
                for="grant_access"
                class="mb-2 block text-sm font-medium ui-muted"
              >
                Can Grant Access to Views
              </label>
              <input
                id="grant_access"
                type="text"
                bind:value={grantAccessViews}
                placeholder="e.g., owner, public (comma-separated)"
                class="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ui-card ui-text ui-border"
              />
              <p class="mt-1 text-xs ui-muted">
                Comma-separated list of views
              </p>
            </div>

            <!-- Revoke Access to Views -->
            <div>
              <label
                for="revoke_access"
                class="mb-2 block text-sm font-medium ui-muted"
              >
                Can Revoke Access to Views
              </label>
              <input
                id="revoke_access"
                type="text"
                bind:value={revokeAccessViews}
                placeholder="e.g., owner, public (comma-separated)"
                class="w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2 ui-card ui-text ui-border"
              />
              <p class="mt-1 text-xs ui-muted">
                Comma-separated list of views
              </p>
            </div>

            <!-- Allowed Actions -->
            <div>
              <div class="mb-2 flex items-center justify-between">
                <label
                  class="block text-sm font-medium ui-muted"
                >
                  Allowed Actions ({selectedActions.length} selected)
                </label>
                <div class="flex gap-2">
                  <button
                    type="button"
                    onclick={selectAllActions}
                    class="text-xs ui-link"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onclick={deselectAllActions}
                    class="text-xs ui-link"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <div class="space-y-4">
                {#each permissionsByCategory as group}
                  <div class="rounded-lg border ui-border">
                    <div class="flex items-center justify-between border-b px-4 py-2 ui-card ui-border">
                      <span class="text-sm font-semibold ui-muted">
                        {group.category}
                        <span class="ml-1 font-normal ui-muted">({countSelectedInGroup(group.permissions)}/{group.permissions.length})</span>
                      </span>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          onclick={() => selectAllInGroup(group.permissions)}
                          class="text-xs ui-link"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onclick={() => deselectAllInGroup(group.permissions)}
                          class="text-xs ui-link"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div class="grid grid-cols-3 gap-1 p-3">
                      {#each group.permissions as action}
                        <label class="flex items-center rounded px-1 py-0.5 ui-hover">
                          <input
                            type="checkbox"
                            checked={selectedActions.includes(action)}
                            onclick={() => toggleAction(action)}
                            data-testid="action-{action}"
                            class="h-4 w-4 rounded focus:ring-2 ui-link ui-panel ui-border"
                          />
                          <span
                            class="ml-2 text-xs ui-muted"
                          >
                            {action}
                          </span>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </div>

          <!-- Form Actions -->
          <div class="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onclick={handleCancel}
              disabled={isSubmitting}
              class="rounded-lg border px-6 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ui-card ui-hover ui-muted ui-border"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              class="rounded-lg px-6 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 preset-filled-primary-500"
            >
              {#if isSubmitting}
                <span class="flex items-center">
                  <svg
                    class="mr-2 h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Updating...
                </span>
              {:else}
                Update System View
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
