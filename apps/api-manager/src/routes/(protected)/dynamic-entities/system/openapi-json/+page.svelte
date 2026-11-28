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

  let {
    data,
  }: {
    data: PageData & {
      tags?: string | null;
      characterCount?: number;
      apiUrl?: string;
    };
  } = $props();

  let copied = $state(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(data.openApiJson);
      copied = true;
      setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }
</script>

<svelte:head>
  <title>OpenAPI JSON - Dynamic Entities - API Manager II</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <!-- Header -->
  <div class="mb-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold ui-text">
          OpenAPI JSON - Dynamic Entities
        </h1>
        <p class="mt-1 ui-muted">
          OpenAPI specification for dynamic entity endpoints
        </p>
        {#if data.tags}
          <p class="mt-1 text-sm ui-muted">
            <span class="font-semibold">Tag:</span>
            {data.tags}
          </p>
        {/if}
        <p class="mt-1 text-sm ui-muted">
          <span class="font-semibold">Character count:</span>
          {data.characterCount?.toLocaleString()}
        </p>
        {#if data.apiUrl}
          <p class="mt-1 text-xs font-mono ui-muted">
            API: {data.apiUrl}
          </p>
        {/if}
      </div>
      <div class="flex gap-2">
        <a
          href="/dynamic-entities/system"
          class="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium ui-card ui-hover ui-muted ui-border"
        >
          <svg
            class="mr-2 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back
        </a>
        <button
          type="button"
          onclick={copyToClipboard}
          class="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium ui-card ui-tone-success"
          title="Copy to clipboard"
        >
          {#if copied}
            <svg
              class="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            Copied!
          {:else}
            <svg
              class="mr-2 h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Copy to Clipboard
          {/if}
        </button>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div
    class="rounded-lg border shadow-sm ui-card ui-border"
  >
    <div class="p-6">
      <pre
        class="overflow-x-auto rounded-lg p-4 text-sm ui-card"><code
          class="ui-text">{data.openApiJson}</code
        ></pre>
    </div>
  </div>
</div>
