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
	import { m } from '$shared/i18n';
	import type { ToolMessage } from '$shared/opey/types';
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
		low: 'ui-tone-success',
		medium:
			'ui-tone-warning',
		high: 'ui-tone-error',
		critical: 'ui-tone-error'
	};

	const riskColor = $derived(
		riskColors[toolMessage.riskLevel?.toLowerCase() as keyof typeof riskColors] || riskColors.medium
	);
</script>

<div class="variant-ghost-warning card rounded-lg border-2 p-4 ui-border">
	<!-- Header -->
	<div class="mb-3 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<Shield class="ui-text-warning" size={24} />
			<h3 class="text-lg font-semibold">{m.tool_approval_required()}</h3>
		</div>
	</div>

	<!-- Tool Information -->
	<div class="mb-4 space-y-2">
		<div>
			<span class="text-sm font-medium">{m.tool_approval_tool()}</span>
			<code class="ms-2 rounded px-2 py-1 text-sm ui-tone-info">
				{toolMessage.toolName}
			</code>
		</div>

		{#if toolMessage.approvalMessage}
			<p class="rounded p-3 text-sm ui-tone-info">
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
					<CheckCircle class="ui-text-success" size={18} />
					<span class="text-sm">{m.tool_approval_reversible()}</span>
				{:else}
					<AlertTriangle class="ui-text-error" size={18} />
					<span class="text-sm">{m.tool_approval_irreversible()}</span>
				{/if}
			</div>
		{/if}

		<!-- Similar Operations -->
		{#if toolMessage.similarOperationsCount !== undefined && toolMessage.similarOperationsCount > 0}
			<div class="flex items-center gap-2">
				<Info class="ui-text-brand" size={18} />
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
			<h4 class="mb-2 text-sm font-medium">{m.tool_approval_resources()}</h4>
			<div class="flex flex-wrap gap-2">
				{#each toolMessage.affectedResources as resource}
					<span class="rounded px-2 py-1 text-xs ui-tone-info">
						{resource}
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Estimated Impact -->
	{#if toolMessage.estimatedImpact}
		<div class="mb-4">
			<h4 class="mb-2 text-sm font-medium">{m.tool_approval_impact()}</h4>
			<p class="rounded p-2 text-sm ui-tone-warning">
				{toolMessage.estimatedImpact}
			</p>
		</div>
	{/if}

	<!-- Tool Input (Collapsible) -->
	{#if toolMessage.toolInput && Object.keys(toolMessage.toolInput).length > 0}
		<details class="mb-4">
			<summary class="cursor-pointer text-sm font-medium">{m.tool_approval_parameters()}</summary>
			<pre
				class="mt-2 overflow-x-auto rounded p-2 text-xs ui-tone-info">{JSON.stringify(
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
				<span class="label-text text-sm font-medium">{m.tool_approval_level()}</span>
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
					<span class="animate-pulse">{m.tool_approval_approving()}</span>
				{:else}
					<CheckCircle size={18} />
					<span>{m.tool_approval_approve()}</span>
				{/if}
			</button>

			<!-- Deny Button -->
			<button class="variant-filled-error btn flex-1" onclick={handleDeny} disabled={isProcessing}>
				{#if isProcessing}
					<span class="animate-pulse">{m.tool_approval_denying()}</span>
				{:else}
					<XCircle size={18} />
					<span>{m.tool_approval_deny()}</span>
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
