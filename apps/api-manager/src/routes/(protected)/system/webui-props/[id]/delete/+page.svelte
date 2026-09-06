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

  // Form states
  let formError = $state("");
  let isDeleting = $state(false);

  async function handleDelete(event: Event) {
    event.preventDefault();

    isDeleting = true;
    formError = "";

    try {
      const response = await fetch(`/backend/webui-props/${data.prop.name}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to delete webui prop",
        );
        logErrorDetails("Delete WebUI Prop", errorDetails);
        const errorMessage = formatErrorForDisplay(errorDetails);

        throw new Error(errorMessage);
      }

      // Success - redirect back to the database filter view
      goto("/system/webui-props?what=database");
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to delete webui prop";
      formError = errorMsg;
      isDeleting = false;
    }
  }

  function handleCancel() {
    goto("/system/webui-props?what=database");
  }
</script>

<div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        Delete WebUI Prop
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Permanently remove this configuration property
      </p>
    </div>

    <div class="mx-auto max-w-2xl">
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

        <!-- Property Details -->
        <div class="mb-6 space-y-4">
          <div>
            <label
              class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Property ID
            </label>
            <div
              class="rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {data.prop?.web_ui_props_id || ""}
            </div>
          </div>

          <div>
            <label
              class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Property Name
            </label>
            <div
              class="rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {data.prop?.name || ""}
            </div>
          </div>

          <div>
            <label
              class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Property Value
            </label>
            <div
              class="max-h-48 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 px-4 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              <pre class="whitespace-pre-wrap break-words">{data.prop?.value ||
                  ""}</pre>
            </div>
          </div>
        </div>

        <!-- Form Actions -->
        <form onsubmit={handleDelete}>
          <div class="flex justify-end gap-3">
            <button
              type="button"
              onclick={handleCancel}
              disabled={isDeleting}
              class="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDeleting}
              class="rounded-lg bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
            >
              {#if isDeleting}
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
                  Deleting...
                </span>
              {:else}
                Delete Property
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
