<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { ShieldUserIcon, ShieldCheck } from '@lucide/svelte';
	import { Tooltip, Dialog, Portal } from '@skeletonlabs/skeleton-svelte';
	import { createLogger } from '$shared/utils/logger';

	const logger = createLogger('OpeyChat');

	import { CookieAuthStrategy } from '$shared/opey/services/AuthStrategy';
	import { ChatState, type ChatStateSnapshot } from '$shared/opey/state/ChatState';
	import { RestChatService } from '$shared/opey/services/RestChatService';
	import { ChatController } from '$shared/opey/controllers/ChatController';
	import { SessionState, type SessionSnapshot } from '$shared/opey/state/SessionState';
	import { OpeySessionService } from '$shared/opey/services/OpeySessionService';
	import { SessionController } from '$shared/opey/controllers/SessionController';
	import type { ToolMessage, ClientToolHandler } from '$shared/opey/types';
	import type { OBPConsentInfo } from '$shared/obp/types';
	import { healthCheckRegistry } from '$shared/health-check/HealthCheckRegistry';

	// Import other components
	import { ToolError, ObpApiResponse, DefaultToolResponse } from './tool-messages';
	import ChatMessage from './ChatMessage.svelte';
	import NewEntitlementsNotice from './NewEntitlementsNotice.svelte';
	import { ConversationRecorder, type ConversationRecordStatus } from '$shared/opey/services/ConversationRecorder';
	import {
		summariseConsentJwt,
		addGrantedConsent,
		activeConsents,
		setConsentReferenceId,
		type GrantedConsentSummary
	} from '$shared/opey/utils/consentSummary';
	import { CircleArrowUp, StopCircle, type Icon as IconType } from '@lucide/svelte';
	import { toast } from '$shared/utils/toastService';
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
		// Endpoint for the new-entitlements notice (defaults to the generic OBP
		// proxy both apps serve). Set to '' to disable the notice entirely.
		entitlementsUrl?: string;
		// Browser-reachable OBP /my/consents listing, used to resolve the
		// consent_reference_id of consents granted to Opey (it is not a JWT claim).
		// Defaults to the generic OBP proxy. Set to '' to skip the lookup.
		consentsUrl?: string;
		// Metrics page that accepts ?consent_reference_id=...; when set, the consent
		// indicator under the input links each reference id to its call log.
		consentMetricsHref?: string;
		// Personal dynamic entity the app records this chat into, as the logged-in user,
		// after each message completes (one row per thread; visible under My Data). Unset
		// means no recording. The entity must exist on the instance; if it does not, the
		// chat says so once and carries on unrecorded.
		conversationEntityName?: string;
		headerClasses?: string; // Optional classes for the header
		footerClasses?: string;
		bodyClasses?: string;
	}
	interface Props {
		opeyChatOptions?: Partial<OpeyChatOptions>; // Optional chat options to customize the component
		userAuthenticated?: boolean; // Optional prop to indicate if the user is authenticated
		splash?: Snippet; // If set, will render the splash screen snippet until the first message is sent
		// upon which the splash screen will dissapear
		belowSuggestions?: Snippet; // If set, rendered directly below the suggested-question pills
		currentBankId?: string; // UI-selected bank, sent to Opey as default-bank context per message
		// Client-executed tools this page can perform (e.g. set_form_fields writing
		// into a form). Keys are tool names; only declared tools are registered into
		// Opey's graph, so pages without handlers never receive client_tool_call events.
		clientTools?: Record<string, ClientToolHandler>;
		// Live description of the page (form fields, types, current values). Called
		// per message so it always reflects what the user currently sees.
		clientContext?: () => string;
	}
	// Default chat options (baseUrl must be supplied by the consuming app)
	const defaultChatOptions: Omit<OpeyChatOptions, 'baseUrl'> = {
		displayHeader: true,
		currentlyActiveUserName: 'Guest',
		displayConnectionPips: true,
		suggestedQuestions: []
	};

	let {
		opeyChatOptions,
		userAuthenticated = false,
		splash,
		belowSuggestions,
		currentBankId = '',
		clientTools,
		clientContext
	}: Props = $props();
	// Merge default options with the provided options
	const options = { ...defaultChatOptions, ...opeyChatOptions } as OpeyChatOptions;

	if (!options.baseUrl) {
		throw new Error(
			'OpeyChat: opeyChatOptions.baseUrl is required. Pass the Opey backend URL from the consuming app.'
		);
	}

	// Initialize session state and services

	const sessionState = new SessionState();
	const sessionService = new OpeySessionService('/backend/opey/auth');
	const sessionController = new SessionController(sessionService, sessionState);

	const chatState = new ChatState();
	const chatService = new RestChatService(
		options.baseUrl,
		new CookieAuthStrategy(),
		// Resolved per message — closure reads the current prop values at send time.
		() => {
			const context: Record<string, unknown> = {};
			if (currentBankId) context.current_bank_id = currentBankId;
			const toolNames = Object.keys(clientTools ?? {});
			if (toolNames.length > 0) {
				context.client_tools = toolNames;
				const pageContext = clientContext?.();
				if (pageContext) context.client_context = pageContext;
			}
			return context;
		}
	);
	const chatController = new ChatController(chatService, chatState);
	// Handlers are read through the controller at event time; keep them current.
	$effect(() => {
		chatController.setClientToolHandlers(clientTools);
	});

	let session: SessionSnapshot = $state({ isAuthenticated: userAuthenticated, status: 'ready' });
	let chat: ChatStateSnapshot = $state({ threadId: '', messages: [], tokenUsage: null });
	let unsubscribeSession: (() => void) | undefined;
	let unsubscribeChat: (() => void) | undefined;

	// Track pending approvals for batch handling
	let pendingApprovalTools = $derived.by(() => {
		return chat.messages.filter(
			(m) => m.role === 'tool' && (m as ToolMessage).waitingForApproval
		) as ToolMessage[];
	});

	// Successful tool calls are the moments the user can gain entitlements
	// mid-session (e.g. creating a bank auto-grants CanCreateEntitlementAtOneBank
	// at that bank). The count feeds NewEntitlementsNotice as its re-check signal.
	let completedToolCallCount = $derived(
		chat.messages.filter((m) => m.role === 'tool' && (m as ToolMessage).status === 'success')
			.length
	);

	// Consents Opey has been granted in this chat, decoded from the JWTs as they
	// pass through handleConsent. Shown beside NewEntitlementsNotice so the user
	// can see what each frozen consent actually embeds versus what they now hold.
	let grantedConsents: GrantedConsentSummary[] = $state([]);
	let liveConsents = $derived(activeConsents(grantedConsents));

	// Conversation recording (see OpeyChatOptions.conversationEntityName).
	let conversationRecordStatus: ConversationRecordStatus = $state('idle');
	let conversationRecordDetail: string = $state('');
	const conversationRecorder: ConversationRecorder | null =
		options.conversationEntityName && userAuthenticated
			? new ConversationRecorder({
					entityName: options.conversationEntityName,
					onStatus: (status, detail) => {
						conversationRecordStatus = status;
						conversationRecordDetail = detail ?? '';
					}
				})
			: null;
	// Most recent grant = the consent Opey is using for its current work.
	let currentConsent = $derived(liveConsents.length > 0 ? liveConsents[liveConsents.length - 1] : null);
	let consentIndicatorOpen = $state(false);

	/**
	 * consent_reference_id is not in the JWT, only in the /my/consents listing
	 * (jti == consent_id, so the match is exact). Best effort: the indicator
	 * falls back to the consent_id until this resolves.
	 */
	async function resolveConsentReferenceId(consentId: string) {
		const url = options.consentsUrl ?? '/proxy/obp/v5.1.0/my/consents';
		if (url === '') return;
		try {
			const res = await fetch(url, { headers: { Accept: 'application/json' } });
			if (!res.ok) return;
			const data = await res.json();
			const match = (Array.isArray(data?.consents) ? data.consents : []).find(
				(c: any) => c?.consent_id === consentId
			);
			if (typeof match?.consent_reference_id === 'string' && match.consent_reference_id) {
				grantedConsents = setConsentReferenceId(grantedConsents, consentId, match.consent_reference_id);
			}
		} catch (error) {
			logger.debug('consent_reference_id lookup failed:', error);
		}
	}

	function formatConsentExpiry(ms: number | null): string {
		if (ms === null) return 'unknown';
		return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	// Server-side Opey connection status (does the app server reach OPEY_BASE_URL?)
	let serverConnectionStatus: 'healthy' | 'unhealthy' | 'degraded' | 'unknown' = $state('unknown');
	// Browser-side Opey connection status (can the user's browser reach options.baseUrl —
	// which is what the chat itself uses to send messages?)
	let browserConnectionStatus: 'healthy' | 'unhealthy' | 'unknown' = $state('unknown');
	// OBP-MCP outbound auth mode (oauth | consent | none) — reported by Opey's /status,
	// originally sourced from OBP-MCP's own /status. null until the first probe completes.
	let obpMcpAuthMode: string | null = $state(null);
	let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

	// Underlying error text per check, surfaced in the click-pip debug popovers below
	// (so the user sees the *real* failure, not a generic "after N attempts" message).
	let serverHealthError: string | null = $state(null);
	let browserHealthError: string | null = $state(null);
	// Which pip's debug popover is currently open (mutually exclusive).
	let openPip: 'server' | 'browser' | 'auth' | null = $state(null);

	async function fetchServerHealthStatus() {
		try {
			const response = await fetch('/backend/status');
			if (!response.ok) {
				serverConnectionStatus = 'unknown';
				serverHealthError = `HTTP ${response.status} ${response.statusText}`;
				return;
			}
			const data = await response.json();
			const opeySnapshot = data.services?.['Opey (server)'];
			if (opeySnapshot) {
				serverConnectionStatus = opeySnapshot.status;
				serverHealthError =
					opeySnapshot.status === 'healthy'
						? null
						: (opeySnapshot.detail || opeySnapshot.error || `status: ${opeySnapshot.status}`);
			} else {
				serverConnectionStatus = 'unknown';
				serverHealthError = "No 'Opey (server)' entry in /backend/status response";
			}
		} catch (error) {
			logger.error('Failed to fetch server health status:', error);
			serverConnectionStatus = 'unknown';
			serverHealthError = error instanceof Error ? error.message : String(error);
		}
	}

	async function fetchBrowserHealthStatus() {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort('timeout'), 5000);
		try {
			const res = await fetch(`${options.baseUrl}/status`, {
				headers: { Accept: 'application/json' },
				signal: controller.signal,
			});
			browserConnectionStatus = res.ok ? 'healthy' : 'unhealthy';
			browserHealthError = res.ok ? null : `HTTP ${res.status} ${res.statusText}`;
			if (res.ok) {
				try {
					const data = await res.json();
					const mode = data?.components?.mcp?.obp_mcp_outbound_auth_via;
					obpMcpAuthMode = typeof mode === 'string' ? mode : null;
				} catch {
					obpMcpAuthMode = null;
				}
			}
		} catch (error) {
			logger.error('Failed to fetch browser-side Opey status:', error);
			browserConnectionStatus = 'unhealthy';
			browserHealthError = error instanceof Error ? error.message : String(error);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	async function fetchHealthStatus() {
		await Promise.all([fetchServerHealthStatus(), fetchBrowserHealthStatus()]);
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
		unsubscribeSession?.();
		unsubscribeChat?.();
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
		unsubscribeSession = sessionState.subscribe((s) => (session = s));
		unsubscribeChat = chatState.subscribe((c) => {
			chat = c;
			// Record completed messages as the user; the recorder ignores unchanged snapshots.
			void conversationRecorder?.record(
				c.threadId,
				c.messages,
				grantedConsents.map((g) => g.referenceId ?? '').filter(Boolean)
			);
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
	function pipColorFor(status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown'): string {
		switch (status) {
			case 'healthy':
				return 'preset-filled-success-500';
			case 'unhealthy':
				return 'preset-filled-error-500';
			case 'degraded':
			case 'unknown':
			default:
				return 'preset-filled-warning-500';
		}
	}

	function statusStringFor(status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown'): string {
		switch (status) {
			case 'healthy':
				return 'connected';
			case 'unhealthy':
				return 'disconnected';
			case 'degraded':
				return 'degraded';
			case 'unknown':
			default:
				return 'unknown';
		}
	}

	let serverConnectionPipColor: string = $derived(pipColorFor(serverConnectionStatus));
	let browserConnectionPipColor: string = $derived(pipColorFor(browserConnectionStatus));
	let serverConnectionStatusString: string = $derived(statusStringFor(serverConnectionStatus));
	let browserConnectionStatusString: string = $derived(statusStringFor(browserConnectionStatus));

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
		let lastError: string | null = null;
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				await initializeOpeySession();
				if (session.status === 'ready') {
					logger.debug(`Opey session initialized successfully on attempt ${attempt}`);
					return;
				}
				// Init didn't throw but the session isn't ready — capture whatever
				// session.error was set to internally so it isn't swallowed.
				if (session.error) lastError = session.error;
			} catch (error) {
				lastError = error instanceof Error ? error.message : String(error);
				logger.warn(`Session initialization attempt ${attempt} failed:`, error);
			}

			if (attempt < maxRetries) {
				const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
				logger.debug(`Retrying session initialization in ${delay}ms...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		// Surface the real underlying cause rather than just "after N attempts".
		const finalMessage = lastError
			? `Failed to initialize after ${maxRetries} attempts: ${lastError}`
			: `Failed to initialize after ${maxRetries} attempts`;
		logger.error(finalMessage);
		sessionState.setStatus('error', finalMessage);
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
		const summary = summariseConsentJwt(consentJwt);
		if (summary) {
			// Keep a previously resolved reference id when the same consent is reused.
			const previous = grantedConsents.find((c) => c.id === summary.id);
			grantedConsents = addGrantedConsent(grantedConsents, {
				...summary,
				referenceId: previous?.referenceId
			});
			if (!previous?.referenceId) void resolveConsentReferenceId(summary.id);
		}
	}

	async function handleConsentDeny(toolCallId: string, reason?: string) {
		await chatController.denyConsent(toolCallId, reason);
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

	/**
	 * Dev helper: simulate a client_tool_call from Opey without a live backend.
	 * Runs the page's registered handler and records the outcome locally, but
	 * does NOT post a result upstream (there is no interrupt to resume).
	 * Usage from the browser console:
	 *   addTestClientToolCall({ fields: { summary: 'Hello' } })
	 */
	async function addTestClientToolCall(toolInput: Record<string, any> = { fields: {} }) {
		const toolCallId = `client-test-${Date.now()}`;
		const handler = clientTools?.['set_form_fields'];
		chatState.addToolMessage({
			id: toolCallId,
			role: 'tool',
			message: '',
			timestamp: new Date(),
			toolName: 'set_form_fields',
			toolCallId,
			toolInput,
			clientExecuted: true
		});
		if (!handler) {
			chatState.updateToolMessage(toolCallId, {
				clientResult: { status: 'error', error: 'No set_form_fields handler on this page' }
			});
			return;
		}
		try {
			const result = ((await handler(toolInput)) ?? {}) as Record<string, unknown>;
			chatState.updateToolMessage(toolCallId, { clientResult: { status: 'applied', ...result } });
		} catch (e) {
			chatState.updateToolMessage(toolCallId, {
				clientResult: { status: 'error', error: e instanceof Error ? e.message : String(e) }
			});
		}
	}

	// TEMPORARY: Expose test functions globally for debugging
	if (typeof window !== 'undefined') {
		(window as any).addTestApprovalMessage = addTestApprovalMessage;
		(window as any).addTestBatchApprovalMessage = addTestBatchApprovalMessage;
		(window as any).addTestClientToolCall = addTestClientToolCall;
	}
</script>

{#snippet header()}
	{#if options.displayHeader}
		<header
			class="align-center flex flex-shrink-0 justify-between preset-filled-secondary-300-700 {options.bodyClasses ||
				''}"
		>
			<img src="/images/opey-logo-inv.png" alt="Opey Logo" class="mx-2 my-auto h-10 w-auto" />
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
				/>
			{/each}
		</div>
	</article>
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

{#snippet tokenIndicator()}
	{#if chat.tokenUsage}
		{@const inp = chat.tokenUsage.inputTokens}
		{@const colorClass =
			inp > 190000
				? 'text-error-500'
				: inp > 160000
					? 'text-warning-600-400'
					: 'text-surface-600-400'}
		<div class="mt-1 text-center text-xs {colorClass}" data-testid="opey-token-usage">
			Context: {Math.round(inp / 1000)}K / 200K tokens
			<span class="text-surface-500">· {chat.tokenUsage.outputTokens} out</span>
		</div>
	{/if}
{/snippet}

{#snippet consentIndicator()}
	{#if currentConsent}
		<div class="relative mt-1 flex justify-end text-xs text-surface-600-400">
			<button
				type="button"
				class="flex items-center gap-1 rounded px-1 hover:text-surface-900-100"
				onclick={() => (consentIndicatorOpen = !consentIndicatorOpen)}
				aria-expanded={consentIndicatorOpen}
				aria-label="Consent Opey is currently using — click for details"
				data-testid="opey-consent-indicator"
			>
				<ShieldCheck class="h-3.5 w-3.5" aria-hidden="true" />
				<span>consent</span>
				<code class="font-mono" data-testid="opey-consent-indicator-id"
					>{currentConsent.referenceId ?? 'resolving…'}</code
				>
			</button>
			{#if consentIndicatorOpen}
				<div
					class="absolute right-0 bottom-full z-20 mb-1 w-80 max-w-[90vw] rounded-md border border-surface-300-700 bg-surface-50-950 p-3 text-left shadow-lg"
					data-testid="opey-consent-indicator-popover"
				>
					<p class="mb-2 font-semibold text-surface-900-100">Consent Opey is using now</p>
					<div class="space-y-0.5" data-testid="opey-consent-row-{currentConsent.id}">
						<div>
							<span class="opacity-70">consent_reference_id</span>
							{#if currentConsent.referenceId && options.consentMetricsHref}
								<a
									href={`${options.consentMetricsHref}?consent_reference_id=${encodeURIComponent(currentConsent.referenceId)}`}
									class="text-tertiary-600-400 hover:underline"
									><code class="font-mono">{currentConsent.referenceId}</code></a
								>
							{:else}
								<code class="font-mono">{currentConsent.referenceId ?? 'resolving…'}</code>
							{/if}
						</div>
						{#each currentConsent.entitlements as e (`${e.role_name}|${e.bank_id}`)}
							<div>
								<code class="font-mono">{e.role_name}</code>
								{#if e.bank_id}<span class="opacity-70">at bank</span> <code class="font-mono">{e.bank_id}</code>{:else}<span class="opacity-70">(system-wide)</span>{/if}
							</div>
						{/each}
						{#each currentConsent.views as v (`${v.bank_id}|${v.account_id}|${v.view_id}`)}
							<div>
								<span class="opacity-70">view</span> <code class="font-mono">{v.view_id}</code>
								<span class="opacity-70">on</span> <code class="font-mono">{v.bank_id}/{v.account_id}</code>
							</div>
						{/each}
						<div class="opacity-70">expires {formatConsentExpiry(currentConsent.expiresAt)}</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet statusPips(session: SessionSnapshot, consentInfo?: OBPConsentInfo)}
	{#if options.displayConnectionPips}
		<div class="flex flex-row items-center gap-1.5">
			<!-- Server-side Opey connection pip — click for debug detail -->
			<div class="relative">
				<button
					type="button"
					class="block h-2 w-2 rounded-full {serverConnectionPipColor} cursor-pointer transition-all hover:scale-125"
					data-testid="opey-pip-server"
					onclick={() => (openPip = openPip === 'server' ? null : 'server')}
					aria-expanded={openPip === 'server'}
					aria-label="Opey server connection — click for details"
					title="Opey (server) — app server → Opey: {serverConnectionStatusString}"
				></button>
				{#if openPip === 'server'}
					<div
						class="absolute right-0 top-4 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-surface-300-700 bg-surface-100-900 p-3 text-xs shadow-lg text-surface-900-100"
						role="dialog"
						aria-label="Opey server connection debug"
						data-testid="opey-pip-server-popover"
					>
						<div class="mb-1 flex items-center justify-between">
							<span class="font-semibold">Opey (server)</span>
							<button type="button" class="text-base leading-none opacity-60 hover:opacity-100" onclick={() => (openPip = null)} aria-label="Close">&times;</button>
						</div>
						<p class="mb-2 opacity-70">App server → Opey: <strong>{serverConnectionStatusString}</strong></p>
						{#if serverHealthError}
							<p class="mb-2 break-words text-error-500 dark:text-error-400">{serverHealthError}</p>
						{/if}
						<a href="/backend/status" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-tertiary-600-400 hover:underline">
							<code class="font-mono text-[11px]">/backend/status</code>
							<span aria-hidden="true">↗</span>
						</a>
					</div>
				{/if}
			</div>

			<!-- Browser-side Opey connection pip — click for debug detail -->
			<div class="relative">
				<button
					type="button"
					class="block h-2 w-2 rounded-full {browserConnectionPipColor} cursor-pointer transition-all hover:scale-125"
					data-testid="opey-pip-browser"
					onclick={() => (openPip = openPip === 'browser' ? null : 'browser')}
					aria-expanded={openPip === 'browser'}
					aria-label="Opey browser connection — click for details"
					title="Opey (browser) — your browser → Opey: {browserConnectionStatusString}"
				></button>
				{#if openPip === 'browser'}
					<div
						class="absolute right-0 top-4 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-surface-300-700 bg-surface-100-900 p-3 text-xs shadow-lg text-surface-900-100"
						role="dialog"
						aria-label="Opey browser connection debug"
						data-testid="opey-pip-browser-popover"
					>
						<div class="mb-1 flex items-center justify-between">
							<span class="font-semibold">Opey (browser)</span>
							<button type="button" class="text-base leading-none opacity-60 hover:opacity-100" onclick={() => (openPip = null)} aria-label="Close">&times;</button>
						</div>
						<p class="mb-2 opacity-70">Your browser → Opey: <strong>{browserConnectionStatusString}</strong></p>
						{#if browserHealthError}
							<p class="mb-2 break-words text-error-500 dark:text-error-400">{browserHealthError}</p>
						{/if}
						<a href={`${options.baseUrl}/status`} target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-tertiary-600-400 hover:underline">
							<code class="font-mono text-[11px] break-all">{options.baseUrl}/status</code>
							<span aria-hidden="true">↗</span>
						</a>
					</div>
				{/if}
			</div>

			<!-- Authentication / Consent pip — click for debug detail -->
			<div class="relative">
				<button
					type="button"
					class="block h-2 w-2 rounded-full {authPipColor} cursor-pointer transition-all hover:scale-125"
					data-testid="opey-pip-auth"
					onclick={() => (openPip = openPip === 'auth' ? null : 'auth')}
					aria-expanded={openPip === 'auth'}
					aria-label="Opey session — click for details"
				></button>
				{#if openPip === 'auth'}
					<div
						class="absolute right-0 top-4 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-surface-300-700 bg-surface-100-900 p-3 text-xs shadow-lg text-surface-900-100"
						role="dialog"
						aria-label="Opey session debug"
						data-testid="opey-pip-auth-popover"
					>
						<div class="mb-1 flex items-center justify-between">
							<span class="font-semibold">Opey session</span>
							<button type="button" class="text-base leading-none opacity-60 hover:opacity-100" onclick={() => (openPip = null)} aria-label="Close">&times;</button>
						</div>
						<p class="mb-2 opacity-70">
							{#if session.status === 'loading'}
								Authenticating…
							{:else if session.status === 'error'}
								Error
							{:else if session.isAuthenticated && consentInfo}
								Authenticated (consent available)
							{:else if session.isAuthenticated}
								Authenticated (no consent info)
							{:else}
								Not authenticated
							{/if}
						</p>
						{#if session.error}
							<p class="mb-2 break-words text-error-500 dark:text-error-400">{session.error}</p>
						{/if}
						<a href="/backend/opey/auth" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-tertiary-600-400 hover:underline">
							<code class="font-mono text-[11px]">/backend/opey/auth</code>
							<span aria-hidden="true">↗</span>
						</a>
						<div class="mt-2">
							<a href="/user#opey-consent" class="text-tertiary-600-400 hover:underline">View consent →</a>
						</div>
					</div>
				{/if}
			</div>

			<!-- OBP-MCP outbound auth mode badge -->
			{#if obpMcpAuthMode}
				<Tooltip>
					<Tooltip.Trigger>
						<span
							class="ml-1 rounded-full bg-primary-200-800 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide cursor-help"
							data-testid="obp-mcp-auth-mode"
						>
							{obpMcpAuthMode}
						</span>
					</Tooltip.Trigger>
					<Portal>
						<Tooltip.Positioner class="z-10">
							<Tooltip.Content class="card bg-primary-200-800 text-xs p-2 max-w-xs">
								OBP-MCP → OBP-API auth mode: <strong>{obpMcpAuthMode}</strong>.
								{#if obpMcpAuthMode === 'consent'}
									Opey calls OBP-API using user-granted Consent-JWTs (scope-limited).
								{:else if obpMcpAuthMode === 'oauth'}
									Opey forwards your OBP-OIDC bearer token directly to OBP-API.
								{:else}
									Unrecognised mode — OBP-API calls will be rejected. Set
									OBP_AUTHORIZATION_VIA to 'oauth' or 'consent' on the MCP server.
								{/if}
								<Tooltip.Arrow class="[--arrow-size:--spacing(2)] [--arrow-background:var(--color-primary-200-800)]">
									<Tooltip.ArrowTip />
								</Tooltip.Arrow>
							</Tooltip.Content>
						</Tooltip.Positioner>
					</Portal>
				</Tooltip>
			{/if}
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
				src="/images/opey_avatar.png"
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
			<div class="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center space-y-6">
				{@render splash()}

				<div class="relative w-2/3 {options.footerClasses || ''} mb-0">
					{@render inputField()}
				</div>

				{@render tokenIndicator()}
				{@render suggestedQuestions()}
				{@render belowSuggestions?.()}
			</div>
		{:else}
			<!--Main Chat Layout: messages fill space, input at bottom-->
			<div class="relative min-h-0 min-w-0 flex-1 overflow-hidden px-4">
				{@render body()}
			</div>

			{@render suggestedQuestions()}

			<div class="flex-shrink-0 px-4 pb-2 {options.footerClasses || ''}">
				{#if options.entitlementsUrl !== ''}
					<NewEntitlementsNotice
						entitlementsUrl={options.entitlementsUrl}
						refreshTrigger={completedToolCallCount}
						enabled={userAuthenticated}
						consents={grantedConsents}
						consentMetricsHref={options.consentMetricsHref}
					/>
				{/if}
				<div class="relative flex items-center justify-center">
					{@render inputField()}
				</div>
				{#if conversationRecorder && conversationRecordStatus !== 'idle'}
					<p class="mt-1 text-[11px] text-surface-500 dark:text-surface-400" data-testid="conversation-record-status">
						{#if conversationRecordStatus === 'saved'}
							This conversation is saved to your data as it goes.
						{:else if conversationRecordStatus === 'unavailable'}
							Conversation recording is not set up on this instance ({options.conversationEntityName} is not defined), so this chat is not saved.
						{:else}
							Saving this conversation failed: {conversationRecordDetail}. It will be retried after the next message.
						{/if}
					</p>
				{/if}
				{@render tokenIndicator()}
				{@render consentIndicator()}
			</div>

			{@render belowSuggestions?.()}
		{/if}
	</div>
</div>
