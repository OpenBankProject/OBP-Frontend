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
	import { Avatar } from '@skeletonlabs/skeleton-svelte';
	import UserAvatar from '$shared/avatar/Avatar.svelte';
	import { userAvatarSeed } from '$shared/avatar/generate';
	import { renderMarkdown } from '$shared/markdown/helper-funcs';
	import type { BaseMessage, ToolMessage as ToolMessageType } from '$shared/opey/types';
	import { ToolMessage } from './tool-messages';
	import { RotateCw, AlertTriangle } from '@lucide/svelte';
	import { fade } from 'svelte/transition';

	// Props
	interface Props {
		message: BaseMessage;
		previousMessageRole?: string;
		onApprove?: (toolCallId: string, approvalLevel?: string) => Promise<void>;
		onDeny?: (toolCallId: string) => Promise<void>;
		onBatchSubmit?: (decisions: Map<string, { approved: boolean; level: string }>) => Promise<void>;
		batchApprovalGroup?: ToolMessageType[];
		userName?: string;
		onRegenerate?: (messageId: string) => Promise<void>;
		onRetry?: () => Promise<void>;
		onConsent?: (toolCallId: string, consentJwt: string) => Promise<void>;
		onConsentDeny?: (toolCallId: string, reason?: string) => Promise<void>;
		foldedTools?: ToolMessageType[]; // Finished tool calls in a row, shown as "…" in place of their panels
		onUnfoldTool?: (toolCallId: string) => void; // The user clicked a "…" to see that tool call again
		startExpanded?: boolean; // Open the tool panel when it first appears
		onToolExpandedChange?: (toolCallId: string, expanded: boolean) => void;
	}

	let {
		message,
		previousMessageRole,
		onApprove,
		onDeny,
		onBatchSubmit,
		batchApprovalGroup,
		userName = 'Guest',
		onRegenerate,
		onRetry,
		onConsent,
		onConsentDeny,
		foldedTools,
		onUnfoldTool,
		startExpanded = false,
		onToolExpandedChange
	}: Props = $props();

	// Check if message can be regenerated
	// Don't allow regeneration for messages with temporary IDs or still pending confirmation
	let canRegenerate = $derived(
		message.role === 'user' && !message.isPending && !message.id.startsWith('temp-')
	);

	// Format error messages - can be extended to handle specific error types
	function getErrorMessage(error?: string): string {
		if (!error) return 'Something went wrong. Please try again.';

		// Future: Add specific error type handling here
		// if (error.includes('Overloaded')) return 'The service is currently busy. Please try again in a moment.';
		// if (error.includes('timeout')) return 'Request timed out. Please try again.';
		// if (error.includes('authentication')) return 'Authentication failed. Please log in again.';

		return error
	}

	// Helper to determine the display role (tool messages are treated as assistant for avatar purposes)
	let displayRole = $derived(message.role === 'tool' ? 'assistant' : message.role);

	let previousDisplayRole = $derived(
		previousMessageRole === 'tool' ? 'assistant' : previousMessageRole
	);

	// Should we show the avatar? - Show avatar for first message or when display role changes
	// Don't show avatar for error messages
	let showAvatar = $derived(
		message.role !== 'error' && (!previousDisplayRole || displayRole !== previousDisplayRole)
	);

	// Finished tool calls that start Opey's reply sit beside its avatar, so it is clear Opey made them.
	let foldedToolsBesideAvatar = $derived(
		showAvatar && message.role === 'tool' && !!foldedTools && foldedTools.length > 0
	);

	// Compute alignment class
	let alignmentClass = $derived(message.role === 'user' ? 'items-end' : 'items-start');
</script>

<!-- Message container -->
<div class="flex flex-col {alignmentClass} justify-start">
	<!-- Avatar and name header -->
	{#if showAvatar}
		<div class="mb-2 flex items-center gap-2">
			{#if message.role === 'user'}
				<p class="text-s font-bold">{userName}</p>
				<UserAvatar
					seed={userAvatarSeed(userName)}
					size={28}
					shape="circle"
					title="Avatar for {userName}"
				/>
			{:else}
				<Avatar class="h-7 w-7 border border-primary-500 bg-secondary-500 p-1">
					<Avatar.Image src="/images/opey-icon-white.png" alt="opey" />
					<Avatar.Fallback>OP</Avatar.Fallback>
				</Avatar>
				<p class="text-s font-bold">Opey</p>
				{#if foldedToolsBesideAvatar}
					{@render foldedToolDots()}
				{/if}
			{/if}
		</div>
	{/if}

	<!-- Message content (empty when the "…" sit beside the avatar) -->
	{#if !foldedToolsBesideAvatar}
	<div
		class="{message.role === 'user' ? 'max-w-3/5' : message.role === 'tool' ? 'w-2/3' : 'max-w-full'} group relative mt-3"
		role="region"
		aria-label="Chat message"
	>
		{#if message.role === 'user'}
			<div class="relative max-w-full rounded-2xl preset-filled-tertiary-500 p-2 text-white">
				{message.message}
			</div>

			<!-- Action buttons - visible on hover via CSS opacity (always in DOM to prevent layout shift).
			     No per-message copy button: native text selection + copy is the mechanism. -->
			<div class="mt-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100" id="message-options">
				{#if onRegenerate && canRegenerate}
					<button
						onclick={() => onRegenerate?.(message.id)}
						class="rounded-full p-1.5 transition-transform hover:scale-120"
						title="Regenerate response"
						aria-label="Regenerate response"
					>
						<RotateCw class="h-4 w-4 text-surface-700 dark:text-surface-200" />
					</button>
				{/if}
			</div>
		{:else if message.role === 'assistant'}
			{#if message.isLoading}
				<!-- Loading spinner while waiting for response -->
				<div class="flex items-center gap-3 p-2">
					<svg
						class="animate-spin text-primary-500"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<circle
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
							stroke-opacity="0.25"
						/>
						<path
							d="M12 2C6.47715 2 2 6.47715 2 12"
							stroke="currentColor"
							stroke-width="4"
							stroke-linecap="round"
						/>
					</svg>
					<span class="text-sm italic opacity-70">Thinking...</span>
				</div>
			{:else}
				<hr class="hr" />
				<div class="prose max-w-full rounded-2xl p-2 text-left dark:prose-invert">
					{@html renderMarkdown(message.message)}
					{#if message.error}
						<div class="mt-2">
							<p class="text-sm text-error-500 dark:text-error-400">
								{getErrorMessage(message.error)}
							</p>
						</div>
					{/if}
				</div>
			{/if}
		{:else if message.role === 'tool' && foldedTools && foldedTools.length > 0}
			{@render foldedToolDots()}
		{:else if message.role === 'tool'}
			<ToolMessage
				{startExpanded}
				onExpandedChange={onToolExpandedChange}
				message={message as ToolMessageType}
				{onApprove}
				{onDeny}
				{onBatchSubmit}
				{batchApprovalGroup}
				{onConsent}
				{onConsentDeny}
			/>
		{:else if message.role === 'error'}
			<div class="max-w-full rounded-lg border border-error-300 bg-error-50 p-4 dark:border-error-700 dark:bg-error-950/30">
				<div class="flex items-start gap-3">
					<AlertTriangle class="mt-0.5 h-5 w-5 flex-shrink-0 text-error-500" />
					<div class="flex-1">
						<p class="text-sm font-medium text-error-700 dark:text-error-300">
							Something went wrong
						</p>
						<p class="mt-1 text-sm text-error-600 dark:text-error-400 whitespace-pre-wrap break-words select-text">
							{getErrorMessage(message.error || message.message)}
						</p>
						{#if onRetry}
							<button
								onclick={() => onRetry?.()}
								class="mt-3 inline-flex items-center gap-1.5 rounded-md bg-error-100 px-3 py-1.5 text-sm font-medium text-error-700 transition-colors hover:bg-error-200 dark:bg-error-900/50 dark:text-error-300 dark:hover:bg-error-900/80"
							>
								<RotateCw class="h-3.5 w-3.5" />
								Retry
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
	{/if}
</div>

{#snippet foldedToolDots()}
	<div class="flex flex-wrap items-center gap-2" in:fade={{ delay: 300, duration: 300 }}>
		{#each foldedTools ?? [] as foldedTool (foldedTool.toolCallId)}
			<button
				type="button"
				class="rounded-md px-2 text-lg leading-none text-surface-600-400 hover:bg-surface-200-800 hover:text-surface-950-50"
				title="Show {foldedTool.toolName.replace(/_/g, ' ')}"
				aria-label="Show the {foldedTool.toolName.replace(/_/g, ' ')} tool call"
				onclick={() => onUnfoldTool?.(foldedTool.toolCallId)}
			>…</button>
		{/each}
	</div>
{/snippet}
