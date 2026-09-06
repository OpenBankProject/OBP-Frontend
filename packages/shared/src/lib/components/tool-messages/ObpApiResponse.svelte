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

<div class="card rounded-lg border-2 p-4 text-left"
     class:border-error-500={isError}
     class:bg-error-50={isError}
     class:dark:bg-error-950={isError}
     class:border-surface-300-700={!isError}
     class:bg-surface-50-950={!isError}>
    <!-- Header -->
    <div class="mb-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
            {#if isError}
                <AlertTriangle class="text-error-600-400" size={20} />
                <h4 class="text-sm font-semibold text-error-700-300">API Response (Error)</h4>
            {:else}
                <CheckCircle class="text-success-600-400" size={20} />
                <h4 class="text-sm font-semibold">API Response</h4>
            {/if}
        </div>
    </div>

    <!-- Tool Name -->
    <div class="mb-3">
        <span class="text-xs font-medium text-surface-600-400">Tool:</span>
        <code class="ml-2 rounded bg-primary-100-900 px-2 py-1 text-xs">
            {message.toolName}
        </code>
    </div>

    <!-- Error Message -->
    {#if isError}
        <div class="mb-3 rounded-lg bg-error-100-900 p-3">
            <div class="text-sm font-medium text-error-950-50">
                {parsedOutput?.message || parsedOutput?.error || 'Request failed'}
            </div>
            {#if parsedOutput?.code || parsedOutput?.status}
                <div class="mt-1 text-xs text-error-700-300">
                    Status Code: {parsedOutput.code || parsedOutput.status}
                </div>
            {/if}
        </div>
    {/if}

    <!-- Output Toggle -->
    <button
        type="button"
        class="btn btn-sm w-full mb-2"
        class:preset-outlined-error-500={isError}
        class:preset-outlined-primary-500={!isError}
        onclick={() => showOutput = !showOutput}
    >
        {showOutput ? 'Hide' : 'View'} Full Response
    </button>

    <!-- Output Content -->
    {#if showOutput}
        <pre class="text-xs text-left mt-2 preset-filled-surface-200-800 p-3 rounded-lg max-h-96 overflow-auto font-mono whitespace-pre border border-surface-300-700">{outputContent}</pre>
    {/if}
</div>
