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

<div class="rounded-lg p-6 shadow-md ui-card">
  {#if formError}
    <div
      class="mb-4 rounded-lg border p-4 ui-tone-error"
      data-testid="webui-prop-error"
    >
      <p class="text-sm ui-text-error">{formError}</p>
    </div>
  {/if}

  <form onsubmit={handleSubmit}>
    <div class="space-y-6">
      {#if mode === "create"}
        <div>
          <label for="name" class="mb-2 block text-sm font-medium ui-muted">
            Name <span class="ui-text-error">*</span>
          </label>
          <input
            id="name"
            type="text"
            bind:value={name}
            required
            placeholder="webui_..."
            class="w-full rounded-lg border px-4 py-2 font-mono text-sm focus:outline-none focus:ring-2 ui-card ui-text ui-border"
            data-testid="webui-prop-name"
          />
          <p class="mt-1 text-xs ui-muted">
            Starts with <code>webui_</code>; letters, digits, <code>_</code> and <code>.</code> only.
          </p>
        </div>
      {/if}

      {#if known}
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="webui-prop-known">
          <dt class="font-medium ui-muted">Used by</dt>
          <dd class="ui-text">{known.usedBy}</dd>
          <dt class="font-medium ui-muted">Format</dt>
          <dd class="ui-text">
            {#if !isMarkdown}Plain text{:else if known.inline}Inline markdown{:else}Markdown{/if}
          </dd>
          {#if known.envVar}
            <dt class="font-medium ui-muted">Overrides</dt>
            <dd class="font-mono ui-text">{known.envVar}</dd>
          {/if}
        </dl>
      {/if}

      <div>
        <label for="value" class="mb-2 block text-sm font-medium ui-muted">
          Value <span class="ui-text-error">*</span>
        </label>
        <textarea
          id="value"
          bind:value
          required
          rows={known && isMarkdown && !known.inline ? 16 : 6}
          class="w-full rounded-lg border px-4 py-2 font-mono text-sm focus:outline-none focus:ring-2 ui-card ui-text ui-border"
          data-testid="webui-prop-value"
        ></textarea>
        {#if !known}
          <p class="mt-1 text-xs ui-muted" data-testid="webui-prop-format">
            {isMarkdown ? "Rendered as markdown" : "Plain text"}
          </p>
        {/if}
      </div>

      {#if known}
        <div>
          <div class="mb-2 text-sm font-medium ui-muted">Preview</div>
          <WebUiPropPreview name={known.name} {value} inline={known.inline} />
        </div>
      {/if}
    </div>

    <div class="mt-8 flex justify-end gap-3">
      <a
        href={LIST_URL}
        class="rounded-lg border px-6 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ui-card ui-hover ui-muted ui-border"
      >
        Cancel
      </a>
      <button
        type="submit"
        disabled={isSubmitting}
        class="rounded-lg px-6 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 preset-filled-primary-500"
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
