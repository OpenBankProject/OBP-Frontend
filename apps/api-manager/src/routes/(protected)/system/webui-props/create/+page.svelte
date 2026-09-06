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
  let formName = $state("");
  let formValue = $state("");
  let formError = $state("");
  let isSubmitting = $state(false);

  async function handleSubmit(event: Event) {
    event.preventDefault();

    if (!formName.trim()) {
      formError = "Property name is required";
      return;
    }

    if (!formValue.trim()) {
      formError = "Property value is required";
      return;
    }

    isSubmitting = true;
    formError = "";

    try {
      const response = await fetch("/backend/webui-props", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formName,
          value: formValue,
        }),
      });

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to create webui prop",
        );
        logErrorDetails("Create WebUI Prop", errorDetails);
        const errorMessage = formatErrorForDisplay(errorDetails);

        throw new Error(errorMessage);
      }

      // Success - redirect back to the database filter view
      goto("/system/webui-props?what=database");
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to create webui prop";
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
        Create WebUI Prop
      </h1>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
        Create a new configuration property for the web interface
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
            <!-- Name Field -->
            <div>
              <label
                for="name"
                class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Property Name <span class="text-red-600">*</span>
              </label>
              <input
                id="name"
                type="text"
                bind:value={formName}
                required
                placeholder="e.g., webui_feature_api_explorer"
                class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Use a descriptive name, typically prefixed with "webui_"
              </p>
            </div>

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

            <!-- Info Box -->
            <div
              class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20"
            >
              <h3
                class="mb-2 flex items-center text-sm font-medium text-blue-900 dark:text-blue-100"
              >
                <svg
                  class="mr-2 h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clip-rule="evenodd"
                  />
                </svg>
                Note
              </h3>
              <ul class="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                <li>• Names MUST start with "webui_"</li>
                <li>
                  • Only "_", "." and alphanumeric characters allowed. No
                  spaces.
                </li>
              </ul>
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
                  Creating...
                </span>
              {:else}
                Create Property
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
