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
      <h1 class="text-3xl font-bold ui-text">
        Delete WebUI Prop
      </h1>
      <p class="mt-2 text-sm ui-muted">
        Permanently remove this configuration property
      </p>
    </div>

    <div class="mx-auto max-w-2xl">
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

        <!-- Property Details -->
        <div class="mb-6 space-y-4">
          <div>
            <label
              class="mb-2 block text-sm font-medium ui-muted"
            >
              Property ID
            </label>
            <div
              class="rounded-lg border px-4 py-2 font-mono text-sm ui-card ui-text ui-border"
            >
              {data.prop?.web_ui_props_id || ""}
            </div>
          </div>

          <div>
            <label
              class="mb-2 block text-sm font-medium ui-muted"
            >
              Property Name
            </label>
            <div
              class="rounded-lg border px-4 py-2 font-mono text-sm ui-card ui-text ui-border"
            >
              {data.prop?.name || ""}
            </div>
          </div>

          <div>
            <label
              class="mb-2 block text-sm font-medium ui-muted"
            >
              Property Value
            </label>
            <div
              class="max-h-48 overflow-y-auto rounded-lg border px-4 py-2 font-mono text-sm ui-card ui-text ui-border"
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
              class="rounded-lg border px-6 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ui-card ui-hover ui-muted ui-border"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDeleting}
              class="rounded-lg px-6 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 preset-filled-error-500"
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
