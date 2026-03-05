import { createLogger } from '$lib/utils/logger';
const logger = createLogger('ChatController');
import { v4 as uuidv4 } from 'uuid';
import type { ChatService, StreamEvent } from '../services/ChatService';
import type { ToolMessage, UserMessage } from '../types';
import { ChatState } from '../state/ChatState';

export class ChatController {
	private toolInstanceCounts: Record<string, number> = {};
	private authRefreshCallback?: () => Promise<void>;

	constructor(
		private service: ChatService,
		public state: ChatState
	) {

		service.onStreamEvent((event: StreamEvent) => {
			logger.debug('Received stream event:', event);
			try {
				switch (event.type) {
				case 'auth_refresh_needed':
					logger.info('Auth refresh needed - triggering callback');
					if (this.authRefreshCallback) {
						this.authRefreshCallback();
					}
					break;
				case 'user_message_confirmed':
					logger.debug(`User message confirmed - backend ID: ${event.messageId}, correlation ID: ${event.correlationId}`);
					state.syncUserMessage(event.messageId, event.correlationId);
					break;
					case 'thread_sync':
						logger.debug(`Syncing thread_id with backend: ${event.threadId}`);
						state.syncThreadId(event.threadId);
						break;
					case 'assistant_start':
						logger.debug(`assistant_start: Creating new assistant message with ID: ${event.messageId}`);
						// Remove any loading messages before adding the actual assistant message
						state.removeLoadingMessages();
						state.addMessage({
							id: event.messageId,
							role: 'assistant',
							message: '',
							timestamp: event.timestamp,
							isStreaming: true
						});
						break;
					case 'assistant_token':
						logger.debug(`assistant_token: Appending token to message ID: ${event.messageId}`);
						state.appendToMessage(event.messageId, event.token);
						break;
					case 'assistant_complete':
						logger.debug('Marking assistant message as complete:', event);
						state.markMessageComplete(event.messageId);
						break;
					case 'tool_start':
						// Remove the approval request message now that the tool is starting
						state.removeApprovalRequest(event.toolCallId);

						// Assign instance number for this tool type
						const instanceNumber = this.assignToolInstance(event.toolName);

						state.addToolMessage({
							id: event.toolCallId,
							role: 'tool',
							message: '',
							timestamp: new Date(),
							toolCallId: event.toolCallId,
							toolName: event.toolName,
							toolInput: event.toolInput,
							isStreaming: true,
							instanceNumber: instanceNumber
						} as ToolMessage); // Cast to ToolMessage for type safety
						break;
					case 'tool_token':
						// We currently dont stream tool ouput, but keep for future compatibility
						// No action needed for tool token in this implementation
						break;
					case 'tool_complete':
						// Debug logging for tool completion
						logger.debug(`Received tool_complete event for ${event.toolCallId}`);
						logger.debug(
							`Tool output: ${JSON.stringify(event.toolOutput)?.substring(0, 200)}...`
						);
						logger.debug(`Tool status: ${event.status}`);

						// Update the toolMessage with the output and status
						const updates: Partial<ToolMessage> = {
							toolOutput: event.toolOutput,
							status: event.status
						};

						// If the tool failed, also set error message from output if available
						if (event.status === 'error' && event.toolOutput) {
							const errorOutput =
								typeof event.toolOutput === 'string'
									? event.toolOutput
									: JSON.stringify(event.toolOutput);
							updates.error = `Tool execution failed: ${errorOutput}`;
						}

						state.updateToolMessage(event.toolCallId, updates);
						state.markMessageComplete(event.toolCallId);
						logger.debug(
							`FRONTEND_DEBUG: Tool message updated and marked complete for ${event.toolCallId}`
						);
						break;
					case 'error':
						if (event.messageId) {
							// Check if this is a tool message - if so, skip updating since tool errors
							// are already handled by the tool_complete event with status: 'error'
							const message = state.getMessage(event.messageId);
							if (message && message.role !== 'tool') {
								state.updateMessage(event.messageId, { error: event.error });
							}
						} else {
							// System error - add new error message only if it's not a tool error
							// Tool errors are already displayed via the tool message component
							state.addMessage({
								id: uuidv4(),
								role: 'error',
								message: '',
								timestamp: new Date(),
								error: event.error
							});
						}
						break;
					case 'approval_request':
						state.addApprovalRequest(
							event.toolCallId,
							event.toolName,
							event.toolInput,
							event.message,
							{
								riskLevel: event.riskLevel,
								affectedResources: event.affectedResources,
								reversible: event.reversible,
								estimatedImpact: event.estimatedImpact,
								similarOperationsCount: event.similarOperationsCount,
								availableApprovalLevels: event.availableApprovalLevels,
								defaultApprovalLevel: event.defaultApprovalLevel
							}
						);
						break;
					case 'batch_approval_request':
						logger.debug(`Received batch approval request for ${event.toolCalls.length} tools`);
						state.addBatchApprovalRequest(event.toolCalls);
						break;
					case 'consent_request':
						logger.debug(`Received consent request for tool ${event.toolCallId}, operation: ${event.operationId}, roles: ${JSON.stringify(event.requiredRoles)}, count: ${event.toolCallCount}, bankId: ${event.bankId}`);
						state.addConsentRequest(
							event.toolCallId,
							event.toolName,
							event.operationId,
							event.requiredRoles,
							event.toolCallCount,
							event.bankId ?? undefined
						);
						break;
				}
			} catch (error) {
				logger.error('Error processing stream event:', error, event);
			}
		});

		service.onError(err => {
			
			this.state.removeLoadingMessages();

			// Don't show errors for aborted streams - user already sees "generation stopped" message
			if (err.message && err.message.includes('BodyStreamBuffer was aborted')) {
				logger.debug('Stream was aborted by user, skipping error message');
				return;
			}

			state.addMessage({
				id: uuidv4(),
				role: 'error',
				message: '',
				timestamp: new Date(),
				error: err.message
			});
		})

		// // EXISTING: Fallback for non-streaming services
		// service.onToolMessage(msg => state.addMessage(msg));
		// // service.onError(err =>
		// //     state.addMessage({
		// //         id: uuidv4(),
		// //         role: 'assistant',
		// //         message: '',
		// //         timestamp: new Date(),
		// //         error: err.message
		// //     })
		// // );
		// //service.onAssistantMessage(msg => state.addMessage(msg));
	}

	send(text: string): Promise<void> {
		// Generate correlation ID for tracking
		const correlationId = uuidv4();
		
		const msg: UserMessage = {
			id: correlationId, // Use correlation ID as temporary ID
			correlationId: correlationId, // Also store explicitly
			role: 'user',
			message: text,
			timestamp: new Date(),
			isPending: true // Mark as pending until backend confirms
		};
		this.state.addMessage(msg);

		// Add a loading message to show user that assistant is thinking
		const loadingMessageId = uuidv4();
		this.state.addMessage({
			id: loadingMessageId,
			role: 'assistant',
			message: '',
			timestamp: new Date(),
			isLoading: true
		});

		logger.debug(`Sending message with correlation ID: ${correlationId}`);

		// Backend will emit user_message_confirmed event with the real ID
		// The event handler will update this message with the backend ID
		return this.service.send(msg, this.state.getThreadId());
	}

	/**
	 * Approve a tool call that's waiting for user approval.
	 * Updates the UI state optimistically and sends approval to backend.
	 * 
	 * @param toolCallId - The tool call ID to approve
	 * @param approvalLevel - Optional approval level (defaults to the tool's defaultApprovalLevel or 'user')
	 */
	async approveToolCall(toolCallId: string, approvalLevel?: string): Promise<void> {
		logger.debug(`Approving tool call: ${toolCallId} with level: ${approvalLevel || 'default'}`);

		// Get the tool message to access its default approval level
		const toolMessage = this.state.getToolMessageByCallId(toolCallId);
		const levelToUse = approvalLevel || toolMessage?.defaultApprovalLevel || 'user';

		// Update state optimistically
		this.state.updateApprovalRequest(toolCallId, true);
		this.state.updateToolMessage(toolCallId, {
			approvalStatus: 'approved',
			approvalLevel: levelToUse,
			waitingForApproval: false
			// Note: isStreaming will be set to true when tool_start event arrives
		});

		try {
			await this.service.sendApproval(toolCallId, true, this.state.getThreadId(), levelToUse);
		} catch (error) {
			logger.error(`Failed to send approval for ${toolCallId}:`, error);
			// Revert optimistic update on error
			this.state.updateToolMessage(toolCallId, {
				approvalStatus: undefined,
				approvalLevel: undefined,
				waitingForApproval: true,
				error: `Failed to send approval: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
			throw error;
		}
	}

	/**
	 * Deny a tool call that's waiting for user approval.
	 * Updates the UI state and sends denial to backend.
	 */
	async denyToolCall(toolCallId: string): Promise<void> {
		logger.debug(`Denying tool call: ${toolCallId}`);

		// Update state
		this.state.updateApprovalRequest(toolCallId, false);
		this.state.updateToolMessage(toolCallId, {
			approvalStatus: 'denied',
			waitingForApproval: false,
			isStreaming: false,
			status: 'error',
			toolOutput: 'Tool execution was denied by user'
		});

		try {
			await this.service.sendApproval(toolCallId, false, this.state.getThreadId());
		} catch (error) {
			logger.error(`Failed to send denial for ${toolCallId}:`, error);
			// Error sending denial - but user already saw it as denied, so just log
			this.state.updateToolMessage(toolCallId, {
				error: `Failed to send denial: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
		}
	}

	/**
	 * Submit batch approval decisions for multiple tool calls at once.
	 * 
	 * @param decisions - Map of toolCallId to approval decision and level
	 */
	async submitBatchApproval(
		decisions: Map<string, { approved: boolean; level: string }>
	): Promise<void> {
		logger.debug(`Submitting batch approval for ${decisions.size} tools`);

		// Update state optimistically for all decisions
		decisions.forEach((decision, toolCallId) => {
			this.state.updateApprovalRequest(toolCallId, decision.approved);

			if (decision.approved) {
				this.state.updateToolMessage(toolCallId, {
					approvalStatus: 'approved',
					approvalLevel: decision.level,
					waitingForApproval: false
					// isStreaming will be set to true when tool_start event arrives
				});
			} else {
				this.state.updateToolMessage(toolCallId, {
					approvalStatus: 'denied',
					waitingForApproval: false,
					isStreaming: false,
					status: 'error',
					toolOutput: 'Tool execution was denied by user'
				});
			}
		});

		try {
			// Convert Map to Record format expected by backend
			const batchDecisions: Record<string, { approved: boolean; level: string }> = {};
			decisions.forEach((decision, toolCallId) => {
				batchDecisions[toolCallId] = decision;
			});

			await this.service.sendBatchApproval(batchDecisions, this.state.getThreadId());
		} catch (error) {
			logger.error('Failed to send batch approval:', error);
			// Revert optimistic updates on error
			decisions.forEach((decision, toolCallId) => {
				this.state.updateToolMessage(toolCallId, {
					approvalStatus: undefined,
					approvalLevel: undefined,
					waitingForApproval: true,
					error: `Failed to send approval: ${error instanceof Error ? error.message : 'Unknown error'}`
				});
			});
			throw error;
		}
	}

	/**
	 * Grant consent by sending the Consent-JWT back to the backend.
	 * The backend will inject the JWT into the tool call headers and retry.
	 */
	async grantConsent(toolCallId: string, consentJwt: string): Promise<void> {
		logger.debug(`Granting consent for tool call: ${toolCallId}`);

		// Update state optimistically
		this.state.updateConsentRequest(toolCallId, true);

		try {
			await this.service.sendConsentResponse(toolCallId, consentJwt, this.state.getThreadId());
		} catch (error) {
			logger.error(`Failed to send consent for ${toolCallId}:`, error);
			// Revert optimistic update on error
			this.state.updateToolMessage(toolCallId, {
				waitingForConsent: true,
				consentStatus: 'pending',
				error: `Failed to send consent: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
			throw error;
		}
	}

	/**
	 * Deny consent — sends null consent_jwt to the backend.
	 * The backend will handle the denial and the stream will continue.
	 */
	async denyConsent(toolCallId: string): Promise<void> {
		logger.debug(`Denying consent for tool call: ${toolCallId}`);

		// Update state
		this.state.updateConsentRequest(toolCallId, false);
		this.state.updateToolMessage(toolCallId, {
			status: 'error',
			toolOutput: 'Consent was denied by user'
		});

		try {
			await this.service.sendConsentResponse(toolCallId, null, this.state.getThreadId());
		} catch (error) {
			logger.error(`Failed to send consent denial for ${toolCallId}:`, error);
			this.state.updateToolMessage(toolCallId, {
				error: `Failed to send consent denial: ${error instanceof Error ? error.message : 'Unknown error'}`
			});
		}
	}

	/**
	 * Get all pending consent requests from the state.
	 */
	getPendingConsentRequests(): ToolMessage[] {
		return this.state.getPendingConsentRequests();
	}

	/**
	 * Get all pending approval requests from the state.
	 */
	getPendingApprovals(): ToolMessage[] {
		return this.state.getPendingApprovals();
	}

	/**
	 * Stop the current streaming response.
	 */
	async stop(): Promise<void> {
		logger.debug('Stopping chat stream');

		// First mark all streaming messages as complete to prevent appending
		this.state.stopAllStreaming();

		// Then call the service to stop the backend stream
		await this.service.cancel(this.state.getThreadId());
	}

	/**
	 * Regenerate the assistant's response starting from a specific user message.
	 * Removes all messages after the specified message and requests a new response.
	 * 
	 * @param messageId - The ID of the user message to regenerate from
	 */
	async regenerate(messageId: string): Promise<void> {
		logger.debug(`Regenerating response from message: ${messageId}`);

		// Remove all messages after this one
		this.state.removeMessagesAfter(messageId);

		// Add a loading message to show user that assistant is thinking
		const loadingMessageId = uuidv4();
		this.state.addMessage({
			id: loadingMessageId,
			role: 'assistant',
			message: '',
			timestamp: new Date(),
			isLoading: true
		});

		try {
			await this.service.regenerate(messageId, this.state.getThreadId());
		} catch (error) {
			logger.error(`Failed to regenerate from ${messageId}:`, error);
			// Remove the loading message on error
			this.state.removeLoadingMessages();
			throw error;
		}
	}

	private assignToolInstance(toolName: string): number {
		if (!this.toolInstanceCounts[toolName]) {
			this.toolInstanceCounts[toolName] = 0;
		}
		this.toolInstanceCounts[toolName]++;
		return this.toolInstanceCounts[toolName];
	}

	async cancel(): Promise<void> {
		await this.service.cancel(this.state.getThreadId());
	}

	/**
	 * Register a callback to be called when auth refresh is needed (401 from Opey).
	 * The callback should refresh the session and return a promise that resolves when done.
	 */
	onAuthRefreshNeeded(callback: () => Promise<void>): void {
		this.authRefreshCallback = callback;
	}
}
