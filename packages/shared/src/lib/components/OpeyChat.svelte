<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { ShieldUserIcon } from '@lucide/svelte';
	import { Tooltip, Dialog, Portal, Menu } from '@skeletonlabs/skeleton-svelte';
	import { createLogger } from '$lib/utils/logger';

	const logger = createLogger('OpeyChat');

	import { CookieAuthStrategy } from '$lib/opey/services/AuthStrategy';
	import { ChatState, type ChatStateSnapshot } from '$lib/opey/state/ChatState';
	import { RestChatService } from '$lib/opey/services/RestChatService';
	import { ChatController } from '$lib/opey/controllers/ChatController';
	import { SessionState, type SessionSnapshot } from '$lib/opey/state/SessionState';
	import { OpeySessionService } from '$lib/opey/services/OpeySessionService';
	import { SessionController } from '$lib/opey/controllers/SessionController';
	import type { ToolMessage } from '$lib/opey/types';
	import type { OBPConsentInfo } from '$lib/obp/types';
	import { healthCheckRegistry } from '$lib/health-check/HealthCheckRegistry';

	// Import other components
	import { ToolError, ObpApiResponse, DefaultToolResponse } from './tool-messages';
	import ChatMessage from './ChatMessage.svelte';
	import { CircleArrowUp, StopCircle, Copy, type Icon as IconType } from '@lucide/svelte';
	import { chatToMarkdown } from '$lib/opey/utils/chatToMarkdown';
	import { toast } from '$lib/utils/toastService';
	import type { Snippet } from 'svelte';

	// Interface for chat options
	export type SuggestedQuestion = {
		questionString: string; // the actual question that will be sent to the chatbot i.e. 'How do I authenticate?'
		pillTitle: string; // the title that will appear in the UI i.e 'Authentication'
		icon?: typeof IconType; // Optional, an icon to display in the pill
	};
	export interface OpeyChatOptions {
		baseUrl: string; // Base Opey URL
		displayHeader: boolean; // Whether to display the header with the logo and title
		currentlyActiveUserName: string; // Optional name of the currently active user
		suggestedQuestions: SuggestedQuestion[]; // List of suggested questions to display
		displayConnectionPips: boolean; // Whether to display connection status pips
		initialAssistantMessage?: string;
		initialUserMessage?: string; // Auto-send this message when session is ready
		currentConsentInfo?: OBPConsentInfo; // Consent info for the status pip
		headerClasses?: string; // Optional classes for the header
		footerClasses?: string;
		bodyClasses?: string;
	}
	interface Props {
		opeyChatOptions?: Partial<OpeyChatOptions>; // Optional chat options to customize the component
		userAuthenticated?: boolean; // Optional prop to indicate if the user is authenticated
		splash?: Snippet; // If set, will render the splash screen snippet until the first message is sent
		// upon which the splash screen will dissapear
	}
	// Default chat options
	const defaultChatOptions: OpeyChatOptions = {
		baseUrl: 'http://localhost:5000',
		displayHeader: true,
		currentlyActiveUserName: 'Guest',
		displayConnectionPips: true,
		suggestedQuestions: []
	};

	let { opeyChatOptions, userAuthenticated = false, splash }: Props = $props();
	// Merge default options with the provided options
	const options = { ...defaultChatOptions, ...opeyChatOptions };

	// Initialize session state and services

	const sessionState = new SessionState();
	const sessionService = new OpeySessionService('/api/opey/auth');
	const sessionController = new SessionController(sessionService, sessionState);

	const chatState = new ChatState();
	const chatService = new RestChatService(options.baseUrl, new CookieAuthStrategy());
	const chatController = new ChatController(chatService, chatState);

	let session: SessionSnapshot = $state({ isAuthenticated: userAuthenticated, status: 'ready' });
	let chat: ChatStateSnapshot = $state({ threadId: '', messages: [] });

	// Track pending approvals for batch handling
	let pendingApprovalTools = $derived.by(() => {
		return chat.messages.filter(
			(m) => m.role === 'tool' && (m as ToolMessage).waitingForApproval
		) as ToolMessage[];
	});

	// Track Opey connection status from health check API
	let connectionStatus: 'healthy' | 'unhealthy' | 'degraded' | 'unknown' = $state('unknown');
	let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

	async function fetchHealthStatus() {
		try {
			const response = await fetch('/api/status');
			if (response.ok) {
				const data = await response.json();
				const opeySnapshot = data.services['Opey II'];

				if (opeySnapshot) {
					connectionStatus = opeySnapshot.status;
				} else {
					connectionStatus = 'unknown';
				}
			}
		} catch (error) {
			logger.error('Failed to fetch health status:', error);
			connectionStatus = 'unknown';
		}
	}

	let splashScreenDisplay = $derived.by(() => {
		return splash && chat.messages.length === 0;
	});

	// Check if any message is currently streaming or loading (waiting for response)
	let isCurrentlyStreaming = $derived.by(() => {
		return chat.messages.some((msg) => msg.isStreaming || msg.isLoading);
	});

	// Auto-scroll management
	let messagesContainer: HTMLElement | null = $state(null);
	let userHasScrolledUp = $state(false);
	let isAutoScrollEnabled = $state(true);

	let isProgrammaticScroll = false;

	function scrollToBottom() {
		if (messagesContainer && isAutoScrollEnabled) {
			isProgrammaticScroll = true;
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}

	function handleScroll(event: Event) {
		// Ignore scroll events fired by scrollToBottom() itself
		if (isProgrammaticScroll) {
			isProgrammaticScroll = false;
			return;
		}

		if (!messagesContainer) return;

		const element = event.target as HTMLElement;
		const isAtBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 10;

		if (isAtBottom) {
			userHasScrolledUp = false;
			isAutoScrollEnabled = true;
		} else {
			userHasScrolledUp = true;
			isAutoScrollEnabled = false;
		}
	}

	async function getMermaidDiagram() {
		try {
			const response = await fetch(`${options.baseUrl}/mermaid_diagram`, {
				method: 'GET',
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error(`Failed to fetch diagram: ${response.statusText}`);
			}

			const blob = await response.blob();
			return URL.createObjectURL(blob); // Returns a blob URL you can use in <img src={...}>
		} catch (error) {
			logger.error('Failed to get Mermaid diagram:', error);
			throw error;
		}
	}

	let diagramUrl = $state<string | null>(null);
	let isLoadingDiagram = $state(false);
	let diagramError = $state<string | null>(null);

	async function loadDiagram() {
		if (diagramUrl || isLoadingDiagram) return; // Already loaded or loading

		isLoadingDiagram = true;
		diagramError = null;
		try {
			diagramUrl = await getMermaidDiagram();
		} catch (error) {
			logger.error('Failed to load diagram:', error);
			diagramError = error instanceof Error ? error.message : 'Failed to load diagram';
		} finally {
			isLoadingDiagram = false;
		}
	}

	// Clean up blob URL and health check interval when component is destroyed
	onDestroy(() => {
		if (diagramUrl) {
			URL.revokeObjectURL(diagramUrl);
		}
		if (healthCheckInterval) {
			clearInterval(healthCheckInterval);
		}
	});

	// Watch for message changes and auto-scroll
	$effect(() => {
		// Trigger on messages change (tokens, tool cards, consent cards, new messages)
		chat.messages;

		if (isAutoScrollEnabled) {
			// Use requestAnimationFrame to ensure DOM has updated
			requestAnimationFrame(() => {
				scrollToBottom();
			});
		}
	});

	onMount(async () => {
		logger.debug('OpeyChat component mounted with options:', options);
		sessionState.subscribe((s) => (session = s));
		chatState.subscribe((c) => {
			chat = c;
		});

		if (options.initialAssistantMessage) {
			chatState.addMessage({
				id: crypto.randomUUID(),
				role: 'assistant',
				message: options.initialAssistantMessage,
				timestamp: new Date()
			});
		}

		// Can set retry parameters here if desired
		// e.g. await initializeOpeySessionWithRetry(5, 2000);
		// would try 5 times with a base delay of 2 seconds
		await initializeOpeySessionWithRetry();

		// Auto-send initial user message if provided and session is ready
		if (options.initialUserMessage && session.status === 'ready') {
			await sendMessage(options.initialUserMessage);
		}

		// Start polling for health status if connection pips are enabled
		if (options.displayConnectionPips) {
			// Fetch immediately
			await fetchHealthStatus();
			// Then poll every 30 seconds
			healthCheckInterval = setInterval(fetchHealthStatus, 30000);
		}
	});

	// Derived colors for pips
	let connectionPipColor: string = $derived.by(() => {
		switch (connectionStatus) {
			case 'healthy':
				return 'preset-filled-success-500';
			case 'unhealthy':
				return 'preset-filled-error-500';
			case 'degraded':
				return 'preset-filled-warning-500';
			case 'unknown':
				return 'preset-filled-warning-500';
			default:
				return 'preset-filled-warning-500';
		}
	});

	let connectionStatusString: string = $derived.by(() => {
		switch (connectionStatus) {
			case 'healthy':
				return 'connected';
			case 'unhealthy':
				return 'disconnected';
			case 'degraded':
				return 'degraded';
			case 'unknown':
				return 'unknown';
			default:
				return 'unknown';
		}
	});

	let authPipColor: string = $derived.by(() => {
		switch (session.status) {
			case 'ready':
				return 'preset-filled-success-500';
			case 'error':
				return 'preset-filled-error-500';
			case 'loading':
				return 'preset-filled-warning-500';
			default:
				return 'preset-filled-warning-500';
		}
	});

	let authPipOpenState = $state(false);

	async function sendMessage(text: string) {
		if (!text.trim()) return;
		await chatController.send(text);
	}

	function handleSendMessage(text: string) {
		if (!text.trim()) return;

		// Prevent sending while streaming - user must explicitly stop first
		if (isCurrentlyStreaming) return;

		// Re-enable auto-scroll when user sends a message
		isAutoScrollEnabled = true;
		userHasScrolledUp = false;

		sendMessage(text);
		messageInput = '';
	}

	function handleKeyPress(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault(); // Prevent newline
			// Don't send if currently streaming
			if (!isCurrentlyStreaming) {
				handleSendMessage(messageInput);
			}
		}
	}

	async function handleStopStreaming() {
		logger.debug('User requested to stop streaming');
		await chatController.stop();
	}

	async function initializeOpeySession() {
		await sessionController.init();
	}

	// Add retry logic with exponential backoff
	async function initializeOpeySessionWithRetry(maxRetries = 3, baseDelay = 1000) {
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				await initializeOpeySession();
				if (session.status === 'ready') {
					logger.debug(`Opey session initialized successfully on attempt ${attempt}`);
					return;
				}
			} catch (error) {
				logger.warn(`Session initialization attempt ${attempt} failed:`, error);
			}

			if (attempt < maxRetries) {
				const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
				logger.debug(`Retrying session initialization in ${delay}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		logger.error(`Failed to initialize session after ${maxRetries} attempts`);
		sessionState.setStatus('error', `Failed to initialize after ${maxRetries} attempts`);
	}

	/**
	 * Connect to banking data (upgrade from anonymous to authenticated)
	 */
	async function upgradeSession() {
		if (!userAuthenticated) {
			window.location.href = '/login';
			return;
		}

		// Re-initialize session - this time with authentication
		await initializeOpeySession();
	}

	let messageInput = $state('');

	function autoResize(event: Event) {
		const textarea = event.target as HTMLTextAreaElement;
		// Reset height to auto to get the correct scrollHeight
		textarea.style.height = 'auto';
		// Set height to scrollHeight, but respect max-height
		textarea.style.height = `${textarea.scrollHeight}px`;
	}

	async function handleApprove(toolCallId: string, approvalLevel?: string) {
		await chatController.approveToolCall(toolCallId, approvalLevel);
	}

	async function handleDeny(toolCallId: string) {
		await chatController.denyToolCall(toolCallId);
	}

	async function handleConsent(toolCallId: string, consentJwt: string) {
		await chatController.grantConsent(toolCallId, consentJwt);
	}

	async function handleConsentDeny(toolCallId: string) {
		await chatController.denyConsent(toolCallId);
	}

	async function handleBatchApprovalSubmit(
		decisions: Map<string, { approved: boolean; level: string }>
	) {
		await chatController.submitBatchApproval(decisions);
	}

	async function handleRegenerate(messageId: string) {
		logger.debug(`Regenerating from message: ${messageId}`);
		// Re-enable auto-scroll when regenerating
		isAutoScrollEnabled = true;
		userHasScrolledUp = false;
		await chatController.regenerate(messageId);
	}

	async function handleRetry() {
		logger.debug('Retrying last message');
		// Find the last user message to regenerate from
		const lastUserMessage = [...chat.messages].reverse().find((m) => m.role === 'user');
		if (lastUserMessage && !lastUserMessage.isPending && !lastUserMessage.id.startsWith('temp-')) {
			isAutoScrollEnabled = true;
			userHasScrolledUp = false;
			await chatController.regenerate(lastUserMessage.id);
		}
	}

	async function handleCopyChat() {
		try {
			const md = chatToMarkdown(chat.messages);
			await navigator.clipboard.writeText(md);
			toast.success('Chat copied to clipboard');
		} catch {
			toast.error('Failed to copy chat');
		}
	}

	// TEMPORARY: Test function to manually trigger a single approval message
	function addTestApprovalMessage() {
		chatState.addApprovalRequest(
			'test-tool-call-123',
			'test_api_call',
			{ endpoint: '/accounts', method: 'POST' },
			'Test approval request - checking dropdown functionality',
			{
				riskLevel: 'medium',
				affectedResources: ['Account 123', 'Transaction ABC'],
				reversible: true,
				estimatedImpact: 'This will modify 2 resources in the test environment',
				similarOperationsCount: 5,
				availableApprovalLevels: ['once', 'session', 'user'],
				defaultApprovalLevel: 'once'
			}
		);
	}

	// TEMPORARY: Test function to manually trigger batch approval (3 tools)
	function addTestBatchApprovalMessage() {
		chatState.addBatchApprovalRequest([
			{
				toolCallId: 'batch-test-1',
				toolName: 'obp_requests',
				toolInput: { endpoint: '/obp/v5.1.0/banks/gh.29.uk/accounts', method: 'POST' },
				message: 'Create a new bank account',
				riskLevel: 'moderate',
				affectedResources: ['Bank gh.29.uk'],
				reversible: false,
				estimatedImpact: 'This will create a new account in the production database',
				similarOperationsCount: 3,
				availableApprovalLevels: ['once', 'session'],
				defaultApprovalLevel: 'once'
			},
			{
				toolCallId: 'batch-test-2',
				toolName: 'obp_requests',
				toolInput: { endpoint: '/obp/v5.1.0/accounts/123', method: 'DELETE' },
				message: 'Delete an existing account',
				riskLevel: 'dangerous',
				affectedResources: ['Account 123', 'Associated Transactions'],
				reversible: false,
				estimatedImpact: 'This will permanently delete account 123 and all associated data',
				similarOperationsCount: 0,
				availableApprovalLevels: ['once'],
				defaultApprovalLevel: 'once'
			},
			{
				toolCallId: 'batch-test-3',
				toolName: 'obp_requests',
				toolInput: { endpoint: '/obp/v5.1.0/accounts', method: 'GET' },
				message: 'Retrieve account list',
				riskLevel: 'low',
				affectedResources: [],
				reversible: true,
				estimatedImpact: 'Read-only operation, no data will be modified',
				similarOperationsCount: 15,
				availableApprovalLevels: ['once', 'session', 'user'],
				defaultApprovalLevel: 'session'
			}
		]);
	}

	// TEMPORARY: Expose test functions globally for debugging
	if (typeof window !== 'undefined') {
		(window as any).addTestApprovalMessage = addTestApprovalMessage;
		(window as any).addTestBatchApprovalMessage = addTestBatchApprovalMessage;
	}
</script>

{#snippet header()}
	{#if options.displayHeader}
		<header
			class="align-center flex flex-shrink-0 justify-between preset-filled-secondary-300-700 {options.bodyClasses ||
				''}"
		>
			<img src="/opey-logo-inv.png" alt="Opey Logo" class="mx-2 my-auto h-10 w-auto" />
			<h1 class="p-2 h4">Chat With Opey</h1>
			<!-- TEMPORARY: Test buttons for approval system -->
			<div class="mx-2 flex gap-2">
				<button class="variant-filled-warning btn btn-sm" onclick={addTestApprovalMessage}>
					Test Single
				</button>
				<button class="variant-filled-error btn btn-sm" onclick={addTestBatchApprovalMessage}>
					Test Batch
				</button>
			</div>
		</header>
	{/if}
{/snippet}

{#snippet toolOutput(message: ToolMessage)}
	{#if message.status === 'error'}
		<ToolError {message} />
	{:else if message.toolName === 'obp_requests'}
		<ObpApiResponse {message} />
	{:else}
		<DefaultToolResponse {message} />
	{/if}
{/snippet}

{#snippet body()}
	<Menu onSelect={(details) => { if (details.value === 'copy-chat') handleCopyChat(); }}>
		<Menu.ContextTrigger
			class="block h-full w-full"
		>
			<article
				bind:this={messagesContainer}
				onscroll={handleScroll}
				class="h-full w-full overflow-y-auto overflow-x-hidden py-4 {options.bodyClasses || ''}"
			>
				<div class="space-y-4 min-w-0">
					{#each chat.messages as message, index (message.id)}
						<ChatMessage
							{message}
							previousMessageRole={index > 0 ? chat.messages[index - 1].role : undefined}
							userName={options.currentlyActiveUserName}
							onApprove={handleApprove}
							onDeny={handleDeny}
							onBatchSubmit={handleBatchApprovalSubmit}
							onRegenerate={handleRegenerate}
							onRetry={handleRetry}
							batchApprovalGroup={pendingApprovalTools.length > 1 ? pendingApprovalTools : undefined}
							onConsent={handleConsent}
							onConsentDeny={handleConsentDeny}
							allMessages={chat.messages}
						/>
					{/each}
				</div>
			</article>
		</Menu.ContextTrigger>
		<Portal>
			<Menu.Positioner>
				<Menu.Content class="card bg-surface-100-900 p-1 shadow-xl">
					<Menu.Item value="copy-chat" disabled={chat.messages.length === 0}>
						<Copy class="mr-2 h-4 w-4" />
						<Menu.ItemText>Copy chat as markdown</Menu.ItemText>
					</Menu.Item>
				</Menu.Content>
			</Menu.Positioner>
		</Portal>
	</Menu>
{/snippet}

{#snippet suggestedQuestions()}
	{#if options.suggestedQuestions.length > 0 && chat.messages.length <= 1}
		<div class="flex flex-wrap justify-center gap-2 p-4">
			{#each options.suggestedQuestions as question}
				<button
					class="text-s btn flex items-center rounded-lg border border-solid border-primary-500 bg-primary-50-950 px-3"
					onclick={() => handleSendMessage(question.questionString)}
					disabled={session?.status !== 'ready'}
				>
					{#if question.icon}
						<question.icon />
					{/if}
					{question.pillTitle}
				</button>
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet statusPips(session: SessionSnapshot, consentInfo?: OBPConsentInfo)}
	{#if options.displayConnectionPips}
		<div class="flex flex-row items-center gap-1.5">
			<!-- Connection Pip with Tooltip -->
			<Tooltip>
				<Tooltip.Trigger>
					<div class="h-2 w-2 rounded-full {connectionPipColor} cursor-pointer transition-all hover:scale-125"></div>
				</Tooltip.Trigger>
				<Portal>
					<Tooltip.Positioner class="z-10">
						<Tooltip.Content class="card bg-primary-200-800 text-xs p-2">
							Opey Connection Status: {connectionStatusString}
							<Tooltip.Arrow class="[--arrow-size:--spacing(2)] [--arrow-background:var(--color-primary-200-800)]">
								<Tooltip.ArrowTip />
							</Tooltip.Arrow>
						</Tooltip.Content>
					</Tooltip.Positioner>
				</Portal>
			</Tooltip>

			<!-- Authentication/Consent Pip with Tooltip -->
			<Tooltip>
				<Tooltip.Trigger>
					<a
						href="/user#opey-consent"
						class="h-2 w-2 rounded-full {authPipColor} cursor-pointer transition-all hover:scale-125 block"
						aria-label="View Opey consent"
					></a>
				</Tooltip.Trigger>
				<Portal>
					<Tooltip.Positioner class="z-10">
						<Tooltip.Content class="card bg-primary-200-800 text-xs p-2">
							{#if session.status === 'loading'}
								Authenticating...
							{:else if session.status === 'error'}
								Error: {session.error}
							{:else if session.isAuthenticated && consentInfo}
								Click to view consent
							{:else if session.isAuthenticated}
								Authenticated (no consent info)
							{:else}
								Not Authenticated
							{/if}
							<Tooltip.Arrow class="[--arrow-size:--spacing(2)] [--arrow-background:var(--color-primary-200-800)]">
								<Tooltip.ArrowTip />
							</Tooltip.Arrow>
						</Tooltip.Content>
					</Tooltip.Positioner>
				</Portal>
			</Tooltip>
		</div>
	{/if}
{/snippet}

{#snippet inputField()}
	<!-- Avatar positioned absolutely to the left of input - clickable easter egg! -->
	<Dialog onOpenChange={(details) => { if (details.open) loadDiagram(); }}>
		<Dialog.Trigger
			class="absolute -left-16 top-1/2 -translate-y-1/2 size-12 cursor-pointer rounded-full drop-shadow-[-7px_7px_10px_var(--color-secondary-500)] transition-transform hover:scale-110"
			title="Click me for a surprise!"
			aria-label="View Opey system diagram"
		>
			<img
				src="/opey_avatar.png"
				alt="Opey Avatar"
				class="h-full w-full rounded-full"
			/>
		</Dialog.Trigger>
			<Portal>
				<Dialog.Backdrop class="fixed inset-0 z-50 bg-surface-50-950/50" />
				<Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
					<Dialog.Content class="card bg-surface-100-900 w-full max-w-4xl space-y-4 p-6 shadow-xl">
						<header class="flex items-center justify-between">
							<Dialog.Title class="text-2xl font-bold">🎉 Opey System Architecture</Dialog.Title>
							<Dialog.CloseTrigger class="btn-icon preset-tonal">✕</Dialog.CloseTrigger>
						</header>
						<Dialog.Description class="text-sm opacity-75">
							Here's a behind-the-scenes look at how Opey works!
						</Dialog.Description>

						<div class="flex min-h-64 items-center justify-center">
							{#if isLoadingDiagram}
								<div class="flex flex-col items-center gap-4">
									<div class="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-500"></div>
									<p class="text-sm opacity-75">Loading diagram...</p>
								</div>
							{:else if diagramError}
								<div class="space-y-2 text-center">
									<p class="text-error-500">😔 Failed to load diagram</p>
									<p class="text-sm opacity-75">{diagramError}</p>
								</div>
							{:else if diagramUrl}
								<img
									src={diagramUrl}
									alt="Opey System Architecture Diagram"
									class="h-auto w-full rounded-container"
								/>
							{/if}
						</div>
					</Dialog.Content>
				</Dialog.Positioner>
			</Portal>
		</Dialog>

		<!-- Unified input container with textarea and controls -->
		<div class="relative w-full rounded-lg bg-primary-50 p-4 dark:bg-primary-600">
		<!-- Text area with auto-resize -->
		<textarea
			bind:value={messageInput}
			placeholder={!userAuthenticated
				? 'Please log in to ask me anything...'
				: chat.messages.length === 0
					? 'Ask me about the Open Bank Project API'
					: 'Ask me anything...'}
			class="w-full resize-none border-none bg-transparent p-0.5 outline-none shadow-none focus:outline-none focus:shadow-none focus:ring-0 focus-visible:outline-none max-h-40 overflow-y-auto"
			style="min-height: 2.5rem;"
			disabled={session?.status !== 'ready'}
			onkeydown={handleKeyPress}
			oninput={autoResize}
			rows="1"
		></textarea>

		<!-- Controls row - always visible at the bottom of the container -->
		<div class="flex w-full items-end justify-between pt-1">
			<div class="flex items-end gap-2">
                {@render statusPips(session, options.currentConsentInfo)}
            </div>

			<div class="flex justify-end items-end">
				{#if isCurrentlyStreaming}
					<button class="btn btn-sm" onclick={handleStopStreaming} title="Stop generation">
						<StopCircle class="h-6 w-6" />
					</button>
				{:else}
					<button
						class="btn btn-primary btn-sm self-end !p-0"
						disabled={session?.status !== 'ready' || !messageInput.trim()}
						onclick={() => handleSendMessage(messageInput)}
					>
						<CircleArrowUp class="h-6 w-6" />
					</button>
				{/if}

			</div>
		</div>
		</div>
{/snippet}

<div class="flex h-full w-full flex-col">
	<!-- Header -->

	{#if !splashScreenDisplay && options.displayHeader}
		<div class="flex-shrink-0 {options.headerClasses || ''}">
			{@render header()}
		</div>
	{/if}

	<div class="flex min-h-0 flex-1 flex-col">
		{#if splashScreenDisplay && splash}
			<!-- Splash layout: centered content with input directly below -->
			<div class="flex flex-1 flex-col items-center justify-center space-y-6">
				{@render splash()}

				<div class="relative w-2/3 {options.footerClasses || ''} mb-0">
					{@render inputField()}
				</div>

				{@render suggestedQuestions()}
			</div>
		{:else}
			<!--Main Chat Layout: messages fill space, input at bottom-->
			<div class="relative min-h-0 min-w-0 flex-1 overflow-hidden px-4">
				{@render body()}
			</div>

			{@render suggestedQuestions()}

			<div class="flex-shrink-0 px-4 pb-2 {options.footerClasses || ''}">
				<div class="relative flex items-center justify-center">
					{@render inputField()}
				</div>
			</div>
		{/if}
	</div>
</div>
