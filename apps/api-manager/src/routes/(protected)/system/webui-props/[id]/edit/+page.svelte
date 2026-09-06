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
  let formName = $state(data.prop?.name || "");
  let formValue = $state(data.prop?.value || "");
  let formError = $state("");
  let isSubmitting = $state(false);

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!formValue.trim()) {
      formError = "Property value is required";
      return;
    }

    isSubmitting = true;
    formError = "";

    try {
      const response = await fetch(`/backend/webui-props/${data.prop.name}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          value: formValue,
        }),
      });

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to update webui prop",
        );
        logErrorDetails("Update WebUI Prop", errorDetails);
        const errorMessage = formatErrorForDisplay(errorDetails);

        throw new Error(errorMessage);
      }

      // Success - redirect back to the database filter view
      goto("/system/webui-props?what=database");
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to update webui prop";
      formError = errorMsg;
      isSubmitting = false;
    }
  }

  function handleCancel() {
    goto("/system/webui-props?what=database");
  }
</script>

<div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
        {formName}
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Update the configuration property
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

        <form onsubmit={handleSubmit}>
          <div class="space-y-6">
            <!-- Value Field -->
            <div>
              <label
                for="value"
                class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Property Value <span class="text-red-600">*</span>
              </label>
              <textarea
                id="value"
                bind:value={formValue}
                required
                rows="8"
                placeholder="Enter the property value (can be text, JSON, Markdown, etc.)"
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
              ></textarea>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter any value - text, JSON, Markdown, HTML, etc.
              </p>
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
                Update Property
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
