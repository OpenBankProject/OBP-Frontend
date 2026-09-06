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
    import type { ToolMessage } from "$shared/opey/types";
    import { CheckCircle } from '@lucide/svelte';

    let { message }: { message: ToolMessage } = $props();

    let outputContent = $derived(
        message.toolOutput
            ? typeof message.toolOutput === "string"
                ? message.toolOutput
                : JSON.stringify(message.toolOutput, null, 2)
            : "No output available."
    );

    let showOutput = $state(false);

</script>

<div class="card rounded-lg border border-surface-300-700 bg-surface-50-950 p-4 text-left">
    <!-- Header -->
    <div class="mb-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
            <CheckCircle class="text-success-600-400" size={20} />
            <h4 class="text-sm font-semibold">Tool Output</h4>
        </div>
    </div>

    <!-- Tool Name -->
    <div class="mb-3">
        <span class="text-xs font-medium text-surface-600-400">Tool:</span>
        <code class="ml-2 rounded bg-primary-100-900 px-2 py-1 text-xs">
            {message.toolName}
        </code>
    </div>

    <!-- Output Toggle -->
    <button
        type="button"
        class="btn preset-outlined-primary-500 btn-sm w-full mb-2"
        onclick={() => showOutput = !showOutput}
    >
        {showOutput ? 'Hide' : 'View'} Output
    </button>

    <!-- Output Content -->
    {#if showOutput}
        <pre class="text-xs text-left mt-2 preset-filled-surface-200-800 p-3 rounded-lg max-h-96 overflow-auto font-mono whitespace-pre border border-surface-300-700">{outputContent}</pre>
    {/if}
</div>
