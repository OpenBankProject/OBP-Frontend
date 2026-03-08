<script lang="ts">
	import { Avatar } from '@skeletonlabs/skeleton-svelte';
	import { renderMarkdown } from '$lib/markdown/helper-funcs';
	import type { BaseMessage, ToolMessage as ToolMessageType } from '$lib/opey/types';
	import { ToolMessage } from './tool-messages';
	import { RotateCw, Copy } from '@lucide/svelte';
	import { messageToMarkdown } from '$lib/opey/utils/chatToMarkdown';
	import { toast } from '$lib/utils/toastService';

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
		onConsent?: (toolCallId: string, consentJwt: string) => Promise<void>;
		onConsentDeny?: (toolCallId: string) => Promise<void>;
		allMessages?: BaseMessage[];
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
		onConsent,
		onConsentDeny,
		allMessages = []
	}: Props = $props();

	// Check if message can be regenerated
	// Don't allow regeneration for messages with temporary IDs or still pending confirmation
	let canRegenerate = $derived(
		message.role === 'user' && !message.isPending && !message.id.startsWith('temp-')
	);

	async function handleCopyAsMarkdown() {
		try {
			const md = messageToMarkdown(message, allMessages);
			await navigator.clipboard.writeText(md);
			toast.success('Copied to clipboard');
		} catch {
			toast.error('Failed to copy');
		}
	}

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
				<Avatar class="h-7 w-7 border border-primary-500 bg-secondary-50 p-1">
					<Avatar.Fallback>{userName.slice(0, 2).toUpperCase()}</Avatar.Fallback>
				</Avatar>
			{:else}
				<Avatar class="h-7 w-7 border border-primary-500 bg-secondary-500 p-1">
					<Avatar.Image src="/opey-icon-white.png" alt="opey" />
					<Avatar.Fallback>OP</Avatar.Fallback>
				</Avatar>
				<p class="text-s font-bold">Opey</p>
			{/if}
		</div>
	{/if}

	<!-- Message content -->
	<div
		class="{message.role === 'user' ? 'max-w-3/5' : message.role === 'tool' ? 'w-2/3' : 'max-w-full'} group relative mt-3"
		role="region"
		aria-label="Chat message"
	>
		{#if message.role === 'user'}
			<div class="relative max-w-full rounded-2xl preset-filled-tertiary-500 p-2 text-white">
				{message.message}
			</div>

			<!-- Action buttons - visible on hover via CSS opacity (always in DOM to prevent layout shift) -->
			<div class="mt-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100" id="message-options">
				<button
					onclick={handleCopyAsMarkdown}
					class="rounded-full p-1.5 transition-transform hover:scale-120"
					title="Copy message"
					aria-label="Copy message"
				>
					<Copy class="h-4 w-4 text-surface-700 dark:text-surface-200" />
				</button>
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
				<div class="mt-1 flex justify-start opacity-0 transition-opacity group-hover:opacity-100">
					<button
						onclick={handleCopyAsMarkdown}
						class="rounded-full p-1.5 transition-transform hover:scale-120"
						title="Copy message"
						aria-label="Copy message"
					>
						<Copy class="h-4 w-4 text-surface-700 dark:text-surface-200" />
					</button>
				</div>
			{/if}
		{:else if message.role === 'tool'}
			<ToolMessage
				message={message as ToolMessageType}
				{onApprove}
				{onDeny}
				{onBatchSubmit}
				{batchApprovalGroup}
				{onConsent}
				{onConsentDeny}
			/>
		{:else if message.role === 'error'}
			<div class="max-w-full p-2">
				<p class="text-sm text-error-500 dark:text-error-400">
					{getErrorMessage(message.error || message.message)}
				</p>
			</div>
		{/if}
	</div>
</div>
