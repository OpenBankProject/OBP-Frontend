<script lang="ts">
	import type { ToolMessage } from '$lib/opey/types';
	import { CheckCircle, XCircle, AlertTriangle, Shield, Info } from '@lucide/svelte';

	interface Props {
		toolMessage: ToolMessage;
		onApprove: (toolCallId: string, approvalLevel?: string) => Promise<void>;
		onDeny: (toolCallId: string) => Promise<void>;
	}

	let { toolMessage, onApprove, onDeny }: Props = $props();

	let selectedApprovalLevel = $state(toolMessage.defaultApprovalLevel || 'once');
	let isProcessing = $state(false);

	async function handleApprove() {
		if (isProcessing) return;
		isProcessing = true;
		try {
			await onApprove(toolMessage.toolCallId, selectedApprovalLevel);
		} finally {
			isProcessing = false;
		}
	}

	$effect(() => {
		console.log('Selected approval level changed:', selectedApprovalLevel);
	})

	async function handleDeny() {
		if (isProcessing) return;
		isProcessing = true;
		try {
			await onDeny(toolMessage.toolCallId);
		} finally {
			isProcessing = false;
		}
	}

	// Risk level styling
	const riskColors = {
		low: 'bg-success-50 text-success-900 border-success-300 dark:bg-success-950 dark:text-success-100',
		medium:
			'bg-warning-50 text-warning-900 border-warning-300 dark:bg-warning-950 dark:text-warning-100',
		high: 'bg-error-50 text-error-900 border-error-300 dark:bg-error-950 dark:text-error-100',
		critical: 'bg-error-100 text-error-950 border-error-500 dark:bg-error-900 dark:text-error-50'
	};

	const riskColor = $derived(
		riskColors[toolMessage.riskLevel?.toLowerCase() as keyof typeof riskColors] || riskColors.medium
	);
</script>

<div class="variant-ghost-warning card rounded-lg border-2 border-surface-500 p-4">
	<!-- Header -->
	<div class="mb-3 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Shield class="text-warning-600 dark:text-warning-400" size={24} />
			<h3 class="text-lg font-semibold">Approval Required</h3>
		</div>
	</div>

	<!-- Tool Information -->
	<div class="mb-4 space-y-2">
		<div>
			<span class="text-sm font-medium">Tool:</span>
			<code class="ml-2 rounded bg-primary-100 px-2 py-1 text-sm dark:bg-primary-800">
				{toolMessage.toolName}
			</code>
		</div>

		{#if toolMessage.approvalMessage}
			<p class="rounded bg-primary-50 p-3 text-sm dark:bg-primary-900">
				{toolMessage.approvalMessage}
			</p>
		{/if}
	</div>

	<!-- Metadata Grid -->
	<div class="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
		<!-- Reversible -->
		{#if toolMessage.reversible !== undefined}
			<div class="flex items-center gap-2">
				{#if toolMessage.reversible}
					<CheckCircle class="text-success-600" size={18} />
					<span class="text-sm">Reversible action</span>
				{:else}
					<AlertTriangle class="text-error-600" size={18} />
					<span class="text-sm">Irreversible action</span>
				{/if}
			</div>
		{/if}

		<!-- Similar Operations -->
		{#if toolMessage.similarOperationsCount !== undefined && toolMessage.similarOperationsCount > 0}
			<div class="flex items-center gap-2">
				<Info class="text-primary-600" size={18} />
				<span class="text-sm">
					{toolMessage.similarOperationsCount} similar operation{toolMessage.similarOperationsCount >
					1
						? 's'
						: ''} found
				</span>
			</div>
		{/if}
	</div>

	<!-- Affected Resources -->
	{#if toolMessage.affectedResources && toolMessage.affectedResources.length > 0}
		<div class="mb-4">
			<h4 class="mb-2 text-sm font-medium">Affected Resources:</h4>
			<div class="flex flex-wrap gap-2">
				{#each toolMessage.affectedResources as resource}
					<span class="rounded bg-primary-100 px-2 py-1 text-xs dark:bg-primary-800">
						{resource}
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Estimated Impact -->
	{#if toolMessage.estimatedImpact}
		<div class="mb-4">
			<h4 class="mb-2 text-sm font-medium">Estimated Impact:</h4>
			<p class="rounded bg-warning-50 p-2 text-sm dark:bg-warning-950">
				{toolMessage.estimatedImpact}
			</p>
		</div>
	{/if}

	<!-- Tool Input (Collapsible) -->
	{#if toolMessage.toolInput && Object.keys(toolMessage.toolInput).length > 0}
		<details class="mb-4">
			<summary class="cursor-pointer text-sm font-medium">View Tool Parameters</summary>
			<pre
				class="mt-2 overflow-x-auto rounded bg-primary-100 p-2 text-xs dark:bg-primary-800">{JSON.stringify(
					toolMessage.toolInput,
					null,
					2
				)}</pre>
		</details>
	{/if}

	<!-- Action Buttons with Approval Level Select -->
	<div class="flex flex-col gap-3">
		<!-- Approval Level Selector (only show if multiple levels available) -->
		{#if toolMessage.availableApprovalLevels && toolMessage.availableApprovalLevels.length > 1}
			<label class="label">
				<span class="label-text text-sm font-medium">Approval Level:</span>
				<select class="select" bind:value={selectedApprovalLevel} disabled={isProcessing} onchange={(e) => selectedApprovalLevel = e.currentTarget.value}>
					{#each toolMessage.availableApprovalLevels as level}
						<option value={level}>
							{level.charAt(0).toUpperCase() + level.slice(1)}
							{#if level === toolMessage.defaultApprovalLevel}(default){/if}
						</option>
					{/each}
				</select>
			</label>
		{/if}

		<!-- Action Buttons -->
		<div class="flex gap-3">
			<!-- Approve Button -->
			<button
				class="variant-filled-success btn flex-1"
				onclick={handleApprove}
				disabled={isProcessing}
			>
				{#if isProcessing}
					<span class="animate-pulse">Approving...</span>
				{:else}
					<CheckCircle size={18} />
					<span>Approve</span>
				{/if}
			</button>

			<!-- Deny Button -->
			<button class="variant-filled-error btn flex-1" onclick={handleDeny} disabled={isProcessing}>
				{#if isProcessing}
					<span class="animate-pulse">Denying...</span>
				{:else}
					<XCircle size={18} />
					<span>Deny</span>
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	details summary {
		list-style: none;
	}
	details summary::-webkit-details-marker {
		display: none;
	}
</style>
