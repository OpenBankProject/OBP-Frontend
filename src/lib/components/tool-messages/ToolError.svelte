<script lang="ts">
	import type { ToolMessage } from '$lib/opey/types';
	import { XCircle, AlertTriangle, Copy } from '@lucide/svelte';
	import { toast } from '$lib/utils/toastService';

	let { message }: { message: ToolMessage } = $props();

	let errorOutput = $derived(
		message.toolOutput
			? typeof message.toolOutput === 'string'
				? message.toolOutput
				: JSON.stringify(message.toolOutput, null, 2)
			: 'Tool execution failed with no details provided.'
	);

	let showDetails = $state(false);

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(errorOutput);
			toast.info('Error details copied to clipboard!');
		} catch (err) {
			console.error('Failed to copy: ', err);
			toast.error('Failed to copy to clipboard.');
		}
	}
</script>

<div class="card rounded-lg border-2 border-error-500 bg-error-50-950 p-4 text-left">
	<!-- Header -->
	<div class="mb-3 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<XCircle class="text-error-600-400" size={24} />
			<h4 class="text-base font-semibold text-error-900-100">Tool Execution Failed</h4>
		</div>
		<button
			type="button"
			class="btn btn-sm preset-tonal-error"
			onclick={copyToClipboard}
			title="Copy error details"
			aria-label="Copy error details"
		>
			<Copy size={16} />
			<span class="hidden sm:inline">Copy</span>
		</button>
	</div>

	<!-- Tool Name -->
	<div class="mb-3">
		<span class="text-xs font-medium text-error-700-300">Tool:</span>
		<code class="ml-2 rounded bg-error-100-900 px-2 py-1 text-xs text-error-900-100">
			{message.toolName}
		</code>
	</div>

	<!-- Error Summary -->
	<div class="mb-3 flex items-start gap-2 rounded-lg bg-error-100-900 p-3">
		<AlertTriangle class="mt-0.5 flex-shrink-0 text-error-600-400" size={18} />
		<div class="text-sm text-error-900-100">
			{typeof message.toolOutput === 'string' && message.toolOutput.length < 150
				? message.toolOutput
				: 'An error occurred during tool execution. Click below to view details.'}
		</div>
	</div>

	<!-- Details Toggle -->
	<button
		type="button"
		class="btn preset-outlined-error-500 btn-sm w-full"
		onclick={() => showDetails = !showDetails}
	>
		{showDetails ? 'Hide' : 'View'} Error Details
	</button>

	<!-- Error Details -->
	{#if showDetails}
		<pre class="text-xs text-left mt-3 preset-filled-surface-200-800 p-3 rounded-lg max-h-96 overflow-auto font-mono whitespace-pre border border-error-300 dark:border-error-700">{errorOutput}</pre>
	{/if}
</div>