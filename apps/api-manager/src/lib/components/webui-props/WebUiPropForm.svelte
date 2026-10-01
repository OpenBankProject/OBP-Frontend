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
  import { findKnownWebUiProp, isWebUiPropMarkdown } from "@obp/shared/config";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";
  import WebUiPropPreview from "./WebUiPropPreview.svelte";

  // Create and edit both PUT /management/webui_props/NAME (create-or-update)
  let {
    mode,
    initialName = "",
    initialValue = "",
  }: { mode: "create" | "edit"; initialName?: string; initialValue?: string } = $props();

  const LIST_URL = "/system/webui-props?what=database";

  // svelte-ignore state_referenced_locally
  let name = $state(initialName);
  // svelte-ignore state_referenced_locally
  let value = $state(initialValue);
  let formError = $state("");
  let isSubmitting = $state(false);

  const known = $derived(findKnownWebUiProp(name.trim()));
  const isMarkdown = $derived(isWebUiPropMarkdown(name.trim()));
  const NAME_PATTERN = /^webui_[A-Za-z0-9_.]+$/;

  async function handleSubmit(event: Event) {
    event.preventDefault();
    const propName = name.trim();

    if (!NAME_PATTERN.test(propName)) {
      formError = 'Name must start with "webui_" and contain only letters, digits, "_" and "."';
      return;
    }
    if (!value.trim()) {
      formError = "Value is required";
      return;
    }

    isSubmitting = true;
    formError = "";

    try {
      const response = await fetch(`/backend/webui-props/${encodeURIComponent(propName)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });

      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          `Failed to ${mode} webui prop`,
        );
        logErrorDetails(`${mode} WebUI Prop`, errorDetails);
        throw new Error(formatErrorForDisplay(errorDetails));
      }

      goto(LIST_URL);
    } catch (err) {
      formError = err instanceof Error ? err.message : `Failed to ${mode} webui prop`;
      isSubmitting = false;
    }
  }
</script>

<div class="rounded-lg bg-white p-6 shadow-md dark:bg-gray-800 dark:shadow-gray-900/50">
  {#if formError}
    <div
      class="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20"
      data-testid="webui-prop-error"
    >
      <p class="text-sm text-red-800 dark:text-red-200">{formError}</p>
    </div>
  {/if}

  <form onsubmit={handleSubmit}>
    <div class="space-y-6">
      {#if mode === "create"}
        <div>
          <label for="name" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Name <span class="text-red-600">*</span>
          </label>
          <input
            id="name"
            type="text"
            bind:value={name}
            required
            placeholder="webui_..."
            class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
            data-testid="webui-prop-name"
          />
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Starts with <code>webui_</code>; letters, digits, <code>_</code> and <code>.</code> only.
          </p>
        </div>
      {/if}

      {#if known}
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="webui-prop-known">
          <dt class="font-medium text-gray-600 dark:text-gray-400">Used by</dt>
          <dd class="text-gray-900 dark:text-gray-100">{known.usedBy}</dd>
          <dt class="font-medium text-gray-600 dark:text-gray-400">Format</dt>
          <dd class="text-gray-900 dark:text-gray-100">
            {#if !isMarkdown}Plain text{:else if known.inline}Inline markdown{:else}Markdown{/if}
          </dd>
          {#if known.envVar}
            <dt class="font-medium text-gray-600 dark:text-gray-400">Overrides</dt>
            <dd class="font-mono text-gray-900 dark:text-gray-100">{known.envVar}</dd>
          {/if}
        </dl>
      {/if}

      <div>
        <label for="value" class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Value <span class="text-red-600">*</span>
        </label>
        <textarea
          id="value"
          bind:value
          required
          rows={known && isMarkdown && !known.inline ? 16 : 6}
          class="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-blue-400"
          data-testid="webui-prop-value"
        ></textarea>
        {#if !known}
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400" data-testid="webui-prop-format">
            {isMarkdown ? "Rendered as markdown" : "Plain text"}
          </p>
        {/if}
      </div>

      {#if known}
        <div>
          <div class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Preview</div>
          <WebUiPropPreview name={known.name} {value} inline={known.inline} />
        </div>
      {/if}
    </div>

    <div class="mt-8 flex justify-end gap-3">
      <a
        href={LIST_URL}
        class="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
      >
        Cancel
      </a>
      <button
        type="submit"
        disabled={isSubmitting}
        class="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        data-testid="webui-prop-submit"
      >
        {#if isSubmitting}
          {mode === "create" ? "Creating…" : "Saving…"}
        {:else}
          {mode === "create" ? "Create" : "Save"}
        {/if}
      </button>
    </div>
  </form>
</div>
