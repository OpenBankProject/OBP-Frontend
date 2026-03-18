<script lang="ts">
    import type { ToolMessage } from '$lib/opey/types';
    import { toast } from '$lib/utils/toastService';
    import { Copy, CheckCircle, AlertTriangle } from '@lucide/svelte';

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

    async function copyToClipboard() {
        try {
            await navigator.clipboard.writeText(outputContent);
            toast.success('Output copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy: ', err);
            toast.error('Failed to copy to clipboard.');
        }
    }
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
