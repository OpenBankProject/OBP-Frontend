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

      const response = await fetch(`/api/system-views/${data.view?.view_id}`, {
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
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        Update System View: {data.view?.short_name}
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Update the system view configuration and permissions
      </p>
    </div>

    <div class="mx-auto max-w-4xl">
      <div
        class="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800 dark:shadow-gray-900/50"
      >
        {#if formError}
          <div
            class="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
          >
            <p class="text-sm text-red-800 dark:text-red-200">{formError}</p>
          </div>
        {/if}

        <form onsubmit={handleSubmit}>
          <div class="space-y-6">
            <!-- Name Field -->
            <div>
              <label
                for="name"
                class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                View Name <span class="text-red-600">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formName}
                disabled
                class="w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                View name cannot be changed
              </p>
            </div>

            <!-- Description Field -->
            <div>
              <label
                for="description"
                class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Description <span class="text-red-600">*</span>
              </label>
              <textarea
                id="description"
                bind:value={formDescription}
                required
                rows="3"
                placeholder="Describe the purpose and scope of this view"
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
              ></textarea>
            </div>

            <!-- Metadata View Field -->
            <div>
              <label
                for="metadata_view"
                class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Metadata View
              </label>
              <textarea
                id="metadata_view"
                bind:value={formMetadataView}
                rows="2"
                placeholder="Optional metadata description (defaults to description)"
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
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
                    class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span
                    class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Public View
                  </span>
                </label>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Accessible to all users
                </p>
              </div>

              <!-- Hide Metadata If Alias Used -->
              <div>
                <label class="flex items-center">
                  <input
                    type="checkbox"
                    bind:checked={formHideMetadataIfAliasUsed}
                    class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span
                    class="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Hide Metadata If Alias Used
                  </span>
                </label>
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Hide metadata when alias is shown
                </p>
              </div>
            </div>

            <!-- Which Alias to Use -->
            <div>
              <label
                for="alias"
                class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Which Alias to Use
              </label>
              <select
                id="alias"
                bind:value={formWhichAliasToUse}
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
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
                class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Can Grant Access to Views
              </label>
              <input
                id="grant_access"
                type="text"
                bind:value={grantAccessViews}
                placeholder="e.g., owner, public (comma-separated)"
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Comma-separated list of views
              </p>
            </div>

            <!-- Revoke Access to Views -->
            <div>
              <label
                for="revoke_access"
                class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Can Revoke Access to Views
              </label>
              <input
                id="revoke_access"
                type="text"
                bind:value={revokeAccessViews}
                placeholder="e.g., owner, public (comma-separated)"
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Comma-separated list of views
              </p>
            </div>

            <!-- Allowed Actions -->
            <div>
              <div class="mb-2 flex items-center justify-between">
                <label
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Allowed Actions ({selectedActions.length} selected)
                </label>
                <div class="flex gap-2">
                  <button
                    type="button"
                    onclick={selectAllActions}
                    class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onclick={deselectAllActions}
                    class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              <div class="space-y-4">
                {#each permissionsByCategory as group}
                  <div class="rounded-lg border border-gray-300 dark:border-gray-600">
                    <div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2 dark:border-gray-600 dark:bg-gray-800">
                      <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {group.category}
                        <span class="ml-1 font-normal text-gray-500 dark:text-gray-400">({countSelectedInGroup(group.permissions)}/{group.permissions.length})</span>
                      </span>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          onclick={() => selectAllInGroup(group.permissions)}
                          class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onclick={() => deselectAllInGroup(group.permissions)}
                          class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div class="grid grid-cols-3 gap-1 p-3">
                      {#each group.permissions as action}
                        <label class="flex items-center rounded px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                          <input
                            type="checkbox"
                            checked={selectedActions.includes(action)}
                            onclick={() => toggleAction(action)}
                            data-testid="action-{action}"
                            class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                          />
                          <span
                            class="ml-2 text-xs text-gray-700 dark:text-gray-300"
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
              class="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
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
