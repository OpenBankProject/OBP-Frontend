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
    import type { ToolMessage } from '$shared/opey/types';
    import { CheckCircle, AlertTriangle } from '@lucide/svelte';

    let { message }: { message: ToolMessage } = $props();

    let parsedOutput = $derived.by(() => {
        try {
            return typeof message.toolOutput === 'string'
                ? JSON.parse(message.toolOutput)
                : message.toolOutput;
        } catch {
            return null;
        }
    });

    let isError = $derived(
        parsedOutput?.error ||
        parsedOutput?.message ||
        (parsedOutput?.code && parsedOutput.code !== 200) ||
        (parsedOutput?.status && parsedOutput.status >= 400)
    );

    let outputContent = $derived(
        parsedOutput
            ? JSON.stringify(parsedOutput, null, 2)
            : typeof message.toolOutput === "string"
                ? message.toolOutput
                : "No output available."
    );

    let showOutput = $state(false);

</script>

<div class="card rounded-lg border-2 p-4 text-start"
     class:ui-tone-error={isError}
     class:ui-card={!isError}
     class:ui-border={!isError}>
    <!-- Header -->
    <div class="mb-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
            {#if isError}
                <AlertTriangle class="ui-text-error" size={20} />
                <h4 class="text-sm font-semibold ui-text-error">API Response (Error)</h4>
            {:else}
                <CheckCircle class="ui-text-success" size={20} />
                <h4 class="text-sm font-semibold">API Response</h4>
            {/if}
        </div>
    </div>

    <!-- Tool Name -->
    <div class="mb-3">
        <span class="text-xs font-medium ui-muted">Tool:</span>
        <code class="ms-2 rounded px-2 py-1 text-xs ui-tone-info">
            {message.toolName}
        </code>
    </div>

    <!-- Error Message -->
    {#if isError}
        <div class="mb-3 rounded-lg p-3 ui-tone-error">
            <div class="text-sm font-medium ui-text-error">
                {parsedOutput?.message || parsedOutput?.error || 'Request failed'}
            </div>
            {#if parsedOutput?.code || parsedOutput?.status}
                <div class="mt-1 text-xs ui-text-error">
                    Status Code: {parsedOutput.code || parsedOutput.status}
                </div>
            {/if}
        </div>
    {/if}

    <!-- Output Toggle -->
    <button
        type="button"
        class="btn btn-sm w-full mb-2 preset-outlined-surface-500"
        onclick={() => showOutput = !showOutput}
    >
        {showOutput ? 'Hide' : 'View'} Full Response
    </button>

    <!-- Output Content -->
    {#if showOutput}
        <pre class="text-xs text-start mt-2 ui-panel p-3 rounded-lg max-h-96 overflow-auto font-mono whitespace-pre border ui-border">{outputContent}</pre>
    {/if}
</div>
