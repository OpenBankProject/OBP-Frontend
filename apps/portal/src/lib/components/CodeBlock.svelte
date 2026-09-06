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
    import { Copy, Check } from '@lucide/svelte';

    interface CodeBlockProps {
        code: string;
        apiHost?: string;
        apiExplorerUrl?: string;
        showHost?: boolean;
    }

    let {
        code,
        apiHost = '',
        apiExplorerUrl = '',
        showHost = false
    }: CodeBlockProps = $props();

    let copied = $state(false);
    let useRealHost = $state(false);

    let displayCode = $derived.by(() => {
        let result = code;
        if (useRealHost && apiHost) {
            result = result.replaceAll('YOUR_OBP_HOST', apiHost);
        }
        if (useRealHost && apiExplorerUrl) {
            result = result.replaceAll('YOUR_API_EXPLORER', apiExplorerUrl);
        }
        return result;
    });

    async function copyToClipboard() {
        try {
            await navigator.clipboard.writeText(displayCode);
            copied = true;
            setTimeout(() => { copied = false; }, 2000);
        } catch {
            // Fallback for non-secure contexts
            const textarea = document.createElement('textarea');
            textarea.value = displayCode;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            copied = true;
            setTimeout(() => { copied = false; }, 2000);
        }
    }
</script>

<div class="relative group my-4" data-testid="code-block">
    <div class="absolute right-2 top-2 flex items-center gap-2 z-10">
        {#if showHost && apiHost}
            <button
                type="button"
                class="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors
                       {useRealHost
                         ? 'bg-primary-500 text-white'
                         : 'bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-300'}
                       hover:opacity-80"
                onclick={() => { useRealHost = !useRealHost; }}
                data-testid="host-toggle"
                title={useRealHost ? 'Show placeholder host' : 'Use actual API host'}
            >
                <span class="inline-block h-2 w-2 rounded-full {useRealHost ? 'bg-white' : 'bg-surface-400'}"></span>
                {useRealHost ? apiHost : 'YOUR_OBP_HOST'}
            </button>
        {/if}
        <button
            type="button"
            class="rounded-md p-1.5 text-surface-400 transition-colors
                   hover:bg-surface-200 hover:text-surface-600
                   dark:hover:bg-surface-700 dark:hover:text-surface-300
                   opacity-0 group-hover:opacity-100"
            onclick={copyToClipboard}
            data-testid="copy-button"
            title="Copy to clipboard"
        >
            {#if copied}
                <Check class="size-4 text-green-500" />
            {:else}
                <Copy class="size-4" />
            {/if}
        </button>
    </div>
    <pre class="rounded-lg bg-surface-100 dark:bg-surface-900 p-4 pr-24 overflow-x-auto text-sm"><code>{displayCode}</code></pre>
</div>
