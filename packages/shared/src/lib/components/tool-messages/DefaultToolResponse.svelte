<script lang="ts">
    import type { ToolMessage } from "$lib/opey/types";
    import { toast } from '$lib/utils/toastService';
    import { Copy, CheckCircle } from '@lucide/svelte';

    let { message }: { message: ToolMessage } = $props();

    let outputContent = $derived(
        message.toolOutput
            ? typeof message.toolOutput === "string"
                ? message.toolOutput
                : JSON.stringify(message.toolOutput, null, 2)
            : "No output available."
    );

    let showOutput = $state(false);

    async function copyToClipboard() {
        try {
            await navigator.clipboard.writeText(outputContent);
            toast.info('Output copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy: ', err);
            toast.error('Failed to copy to clipboard.');
        }
    }
</script>

<div class="card rounded-lg border border-surface-300-700 bg-surface-50-950 p-4 text-left">
    <!-- Header -->
    <div class="mb-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
            <CheckCircle class="text-success-600-400" size={20} />
            <h4 class="text-sm font-semibold">Tool Output</h4>
        </div>
        <button
            type="button"
            class="btn btn-sm preset-tonal-primary"
            onclick={copyToClipboard}
            title="Copy output"
            aria-label="Copy output"
        >
            <Copy size={16} />
            <span class="hidden sm:inline">Copy</span>
        </button>
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
