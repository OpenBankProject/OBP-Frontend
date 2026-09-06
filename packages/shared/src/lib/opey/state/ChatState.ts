/*
 * Copyright (C) 2025-2026 TESOBE GmbH
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */
import { createLogger } from '$shared/utils/logger';
const logger = createLogger('ChatState');
import type { BaseMessage, ToolMessage, ConsentMyResources } from '../types';

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
}

/** What the app's Opey proxy reported after writing this thread into the user's conversation entity. */
export interface ConversationRecordInfo {
	status: 'saved' | 'unavailable' | 'error';
	entityName: string;
	recordId?: string;
	messageCount?: number;
	detail?: string;
}

export interface ChatStateSnapshot {
	threadId: string;
	messages: BaseMessage[];
	tokenUsage: TokenUsage | null;
	/** null until the proxy reports on this thread (anonymous users, or apps that do not record, never see one). */
	conversationRecord: ConversationRecordInfo | null;
}

export class ChatState {
	private threadId: string;
	private messages: BaseMessage[] = [];
	private subscribers: Array<(snapshot: ChatStateSnapshot) => void> = [];
	private sessionStartTime: Date = new Date();
	// Token usage from the most recent assistant turn (Anthropic's real counts).
	private tokenUsage: TokenUsage | null = null;
	private conversationRecord: ConversationRecordInfo | null = null;

	constructor(threadId?: string) {
		this.threadId = threadId || crypto.randomUUID(); // Generate a new thread ID if not provided
		this.sessionStartTime = new Date();
	}

	/** returns the current thread ID */
	getThreadId(): string {
		return this.threadId;
	}

	/** resets to a new thread (e.g. "New Chat" button) */
	setThreadId(newId: string = crypto.randomUUID()): void {
		this.threadId = newId;
		this.messages = [];
		this.sessionStartTime = new Date();
		this.tokenUsage = null;
		this.conversationRecord = null;
		this.emit(); // Notify subscribers about the change
	}

	/** Record what the proxy said about saving this thread (see the conversation_recorded stream event). */
	setConversationRecord(info: ConversationRecordInfo | null): void {
		this.conversationRecord = info;
		this.emit();
	}

	/** Record token usage from the latest assistant turn (raw counts from the backend). */
	setTokenUsage(usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number }): void {
		if (!usage) return;
		const inputTokens = usage.input_tokens ?? 0;
		const outputTokens = usage.output_tokens ?? 0;
		this.tokenUsage = {
			inputTokens,
			outputTokens,
			totalTokens: usage.total_tokens ?? inputTokens + outputTokens
		};
		this.emit();
	}

	/** synchronizes thread_id with backend without clearing messages */
	syncThreadId(backendThreadId: string): void {
		if (this.threadId !== backendThreadId) {
			logger.debug(`Syncing thread_id: ${this.threadId} -> ${backendThreadId}`);
			this.threadId = backendThreadId;
			this.emit(); // Notify subscribers about the change
		}
	}

	/**
	 * Sync a user message with backend-assigned ID using correlation ID.
	 * This is more reliable than matching by content.
	 */
	syncUserMessage(backendId: string, correlationId: string): void {
		// First check if we already have a message with this backend ID
		// This can happen if confirmations come out of order or during cancellation
		const existingMessage = this.messages.find(msg => msg.id === backendId);
		if (existingMessage) {
			logger.debug(`Message with backend ID ${backendId} already exists, skipping sync`);
			return;
		}

		// Find message by correlation ID (much more reliable than content matching)
		const index = this.messages.findIndex(
			msg => msg.correlationId === correlationId && msg.isPending === true
		);
		
		if (index !== -1) {
			logger.debug(`Syncing message via correlation ID: ${correlationId} → backend ID: ${backendId}`);
			this.messages[index].id = backendId;
			this.messages[index].isPending = false;
			this.messages = [...this.messages]; // Trigger reactivity
			this.emit();
		} else {
			// This shouldn't happen in normal flow
			logger.warn(`Received user_message_confirmed for correlation ID ${correlationId} (backend ID: ${backendId}) but no matching pending message found.`);
			// Don't add the message - it may have already been synced or removed
		}
	}

	addMessage(message: BaseMessage): void {
		// Check for duplicate IDs
		if (this.messages.some((existing) => existing.id === message.id)) {
			logger.warn(`Duplicate message ID detected: ${message.id}. Skipping duplicate message.`);
			return;
		}
		this.messages.push(message);
		this.emit();
	}

	addToolMessage(toolMessage: ToolMessage): void {
		// Check for duplicate IDs
		if (this.messages.some((existing) => existing.id === toolMessage.id)) {
			logger.warn(
				`Duplicate tool message ID detected: ${toolMessage.id}. Skipping duplicate message.`
			);
			return;
		}
		this.messages.push(toolMessage);
		this.emit();
	}

	// Helper to find a message by its ID
	getMessage(messageId: string): BaseMessage | undefined {
		return this.messages.find((msg) => msg.id === messageId);
	}

	// Helper to find a tool message by its toolCallId
	getToolMessageByCallId(toolCallId: string): ToolMessage | undefined {
		return this.messages.find(
			(msg) => msg.role === 'tool' && (msg as ToolMessage).toolCallId === toolCallId
		) as ToolMessage | undefined;
	}

	/**
	 * Add or update a tool message to indicate it's waiting for approval.
	 * Includes approval metadata from the backend.
	 */
	addApprovalRequest(
		toolCallId: string,
		toolName: string,
		toolInput: Record<string, any>,
		approvalMessage: string,
		metadata: {
			riskLevel: string;
			affectedResources: string[];
			reversible: boolean;
			estimatedImpact: string;
			similarOperationsCount: number;
			availableApprovalLevels: string[];
			defaultApprovalLevel: string;
		}
	): void {
		// Find corresponding tool message and set waitingForApproval=true
		const toolMessage = this.getToolMessageByCallId(toolCallId);

		if (toolMessage) {
			// Update existing tool message with approval request
			toolMessage.waitingForApproval = true;
			toolMessage.approvalStatus = undefined; // Reset if previously set
			toolMessage.approvalMessage = approvalMessage;
			toolMessage.riskLevel = metadata.riskLevel;
			toolMessage.affectedResources = metadata.affectedResources;
			toolMessage.reversible = metadata.reversible;
			toolMessage.estimatedImpact = metadata.estimatedImpact;
			toolMessage.similarOperationsCount = metadata.similarOperationsCount;
			toolMessage.availableApprovalLevels = metadata.availableApprovalLevels;
			toolMessage.defaultApprovalLevel = metadata.defaultApprovalLevel;
		} else {
			logger.warn(`No tool message found for approval request: ${toolCallId}, creating new one`);
			// Create a new tool message if one doesn't exist
			this.addToolMessage({
				id: toolCallId,
				role: 'tool',
				message: '',
				timestamp: new Date(),
				toolCallId: toolCallId,
				toolName: toolName,
				toolInput: toolInput,
				isStreaming: false,
				waitingForApproval: true,
				approvalMessage,
				riskLevel: metadata.riskLevel,
				affectedResources: metadata.affectedResources,
				reversible: metadata.reversible,
				estimatedImpact: metadata.estimatedImpact,
				similarOperationsCount: metadata.similarOperationsCount,
				availableApprovalLevels: metadata.availableApprovalLevels,
				defaultApprovalLevel: metadata.defaultApprovalLevel
			} as ToolMessage);
		}

		this.messages = [...this.messages]; // Force Svelte reactivity
		this.emit();
	}

	/**
	 * Add multiple approval requests at once (for batch approvals).
	 * This creates/updates tool messages for each approval request.
	 */
	addBatchApprovalRequest(
		toolCalls: Array<{
			toolCallId: string;
			toolName: string;
			toolInput: Record<string, any>;
			message: string;
			riskLevel: string;
			affectedResources: string[];
			reversible: boolean;
			estimatedImpact: string;
			similarOperationsCount: number;
			availableApprovalLevels: string[];
			defaultApprovalLevel: string;
		}>
	): void {
		logger.debug(`Adding batch approval request for ${toolCalls.length} tools`);
		
		toolCalls.forEach(toolCall => {
			this.addApprovalRequest(
				toolCall.toolCallId,
				toolCall.toolName,
				toolCall.toolInput,
				toolCall.message,
				{
					riskLevel: toolCall.riskLevel,
					affectedResources: toolCall.affectedResources,
					reversible: toolCall.reversible,
					estimatedImpact: toolCall.estimatedImpact,
					similarOperationsCount: toolCall.similarOperationsCount,
					availableApprovalLevels: toolCall.availableApprovalLevels,
					defaultApprovalLevel: toolCall.defaultApprovalLevel
				}
			);
		});
	}

	/**
	 * Get all tool messages that are currently waiting for approval.
	 */
	getPendingApprovals(): ToolMessage[] {
		return this.messages.filter(
			msg => msg.role === 'tool' && (msg as ToolMessage).waitingForApproval
		) as ToolMessage[];
	}

	/**
	 * Add or update a tool message to indicate it's waiting for consent.
	 */
	addConsentRequest(
		toolCallId: string,
		toolName: string,
		operationId: string | null,
		requiredRoles: string[],
		toolCallCount: number,
		bankId?: string,
		accountId?: string,
		viewId?: string,
		requiresViewAccess: boolean = false,
		isUserScoped: boolean = false,
		myResources: ConsentMyResources | null = null
	): void {
		const toolMessage = this.getToolMessageByCallId(toolCallId);

		if (toolMessage) {
			toolMessage.waitingForConsent = true;
			toolMessage.consentStatus = 'pending';
			toolMessage.consentOperationId = operationId || undefined;
			toolMessage.consentRequiredRoles = requiredRoles;
			toolMessage.consentToolCallCount = toolCallCount;
			if (bankId) toolMessage.consentBankId = bankId;
			if (accountId) toolMessage.consentAccountId = accountId;
			if (viewId) toolMessage.consentViewId = viewId;
			toolMessage.consentRequiresViewAccess = requiresViewAccess;
			toolMessage.consentIsUserScoped = isUserScoped;
			toolMessage.consentMyResources = myResources ?? undefined;
		} else {
			logger.warn(`No tool message found for consent request: ${toolCallId}, creating new one`);
			this.addToolMessage({
				id: toolCallId,
				role: 'tool',
				message: '',
				timestamp: new Date(),
				toolCallId: toolCallId,
				toolName: toolName,
				toolInput: {},
				isStreaming: false,
				waitingForConsent: true,
				consentStatus: 'pending',
				consentOperationId: operationId ?? undefined,
				consentRequiredRoles: requiredRoles,
				consentToolCallCount: toolCallCount,
				consentBankId: bankId,
				consentAccountId: accountId,
				consentViewId: viewId,
				consentRequiresViewAccess: requiresViewAccess,
				consentIsUserScoped: isUserScoped,
				consentMyResources: myResources ?? undefined
			} as ToolMessage);
		}

		this.messages = [...this.messages];
		this.emit();
	}

	/**
	 * Update consent request status.
	 */
	updateConsentRequest(toolCallId: string, granted: boolean): void {
		const toolMessage = this.getToolMessageByCallId(toolCallId);

		if (toolMessage) {
			toolMessage.consentStatus = granted ? 'granted' : 'denied';
			toolMessage.waitingForConsent = false;
		}

		this.messages = [...this.messages];
		this.emit();
	}

	/**
	 * Get all tool messages that are currently waiting for consent.
	 */
	getPendingConsentRequests(): ToolMessage[] {
		return this.messages.filter(
			msg => msg.role === 'tool' && (msg as ToolMessage).waitingForConsent
		) as ToolMessage[];
	}

	// Update to set approval status and force update
	updateApprovalRequest(toolCallId: string, approved: boolean): void {
		// Update the tool message with approval status
		const toolMessage = this.getToolMessageByCallId(toolCallId);

		if (toolMessage) {
			toolMessage.approvalStatus = approved ? 'approved' : 'denied';
			// Don't set waitingForApproval=false yet - that happens when the tool_start event comes
		}

		this.messages = [...this.messages]; // Force Svelte reactivity
		this.emit();
	}

	// Update this to properly update the tool message on tool_start
	removeApprovalRequest(toolCallId: string): void {
		const toolMessage = this.getToolMessageByCallId(toolCallId);

		if (toolMessage) {
			toolMessage.waitingForApproval = false;
			// Don't reset approvalStatus - keep 'approved' or 'denied' status

			// Important: If tool was approved, ensure it's now marked as streaming
			if (toolMessage.approvalStatus === 'approved') {
				toolMessage.isStreaming = true;
			}
		}

		this.messages = [...this.messages]; // Force Svelte reactivity
		this.emit();
	}

	/** Remove any loading messages (typically when actual assistant message arrives) */
	removeLoadingMessages(): void {
		this.messages = this.messages.filter((msg) => !msg.isLoading);
		this.emit();
	}

	appendToMessage(messageId: string, text: string): void {
		const message = this.messages.find((msg) => msg.id === messageId);
		if (message) {
			message.message += text; // Append text to the existing message
			this.messages = [...this.messages]; // Force Svelte reactivity
			this.emit(); // Notify subscribers about the change
		} else {
			logger.debug(`Message with ID ${messageId} not found for append operation.`);
		}
	}

	markMessageComplete(messageId: string): void {
		const message = this.messages.find((msg) => msg.id === messageId);
		if (!message) {
			logger.error(`Message ${messageId} not found for completion`);
			return;
		}

		if (!message.isStreaming) {
			logger.error(`Message ${messageId} is already marked as complete`);
			return;
		}

		message.isStreaming = false;
		this.messages = [...this.messages];
		this.emit();
		logger.debug(`Marked message ${messageId} as complete`);
	}

	updateMessage(messageId: string, updates: Partial<BaseMessage>): void {
		const message = this.messages.find((msg) => msg.id === messageId);
		if (message) {
			Object.assign(message, updates); // Update the message with the provided fields
			this.messages = [...this.messages]; // Force Svelte reactivity
			this.emit(); // Notify subscribers about the change
		} else {
			// Reduce noise - only log if we're actually tracking messages
			if (this.messages.length > 0) {
				logger.debug(`Message with ID ${messageId} not found for update operation.`);
			}
		}
	}

	/**
	 * Update a tool message by its toolCallId.
	 * Note: This searches by toolCallId, not by message.id
	 */
	updateToolMessage(toolCallId: string, updates: Partial<ToolMessage>): void {
		logger.debug(`Updating tool message with toolCallId: ${toolCallId}`);
		
		const toolMessage = this.getToolMessageByCallId(toolCallId);
		
		if (toolMessage) {
			logger.debug(`Found tool message, applying updates:`, updates);
			Object.assign(toolMessage, updates);
			this.messages = [...this.messages]; // Force Svelte reactivity
			this.emit();
		} else {
			logger.warn(`Tool message with toolCallId ${toolCallId} not found for update`);
		}
	}

	subscribe(fn: (msgs: ChatStateSnapshot) => void): () => void {
		this.subscribers.push(fn);
		logger.debug('ChatState: Subscribed to messages');
		fn(this.snapshot()); // Send current state immediately
		// Unsubscribe — call on component destroy or the subscriber leaks.
		return () => {
			this.subscribers = this.subscribers.filter((s) => s !== fn);
		};
	}

	/**
	 * Mark all currently streaming messages as complete.
	 * Used when cancelling/stopping a stream to prevent new messages from being appended.
	 */
	stopAllStreaming(): void {
		logger.debug('Stopping all streaming messages');
		let updated = false;
		
		this.messages.forEach(message => {
			if (message.isStreaming) {
				message.isStreaming = false;
				message.cancelled = true;
				updated = true;
				logger.debug(`Marked message ${message.id} as cancelled`);
			}
		});

		if (updated) {
			this.messages = [...this.messages]; // Force Svelte reactivity
			this.emit();
		}
	}

	/**
	 * Remove all messages after a specific message ID (inclusive of the next message).
	 * Used when regenerating a response from a specific point.
	 */
	removeMessagesAfter(messageId: string): void {
		const index = this.messages.findIndex((msg) => msg.id === messageId);
		if (index === -1) {
			logger.warn(`Message with ID ${messageId} not found for removeMessagesAfter`);
			return;
		}
		
		// Remove all messages after the specified message (but keep the message itself)
		const removedCount = this.messages.length - index - 1;
		this.messages = this.messages.slice(0, index + 1);
		logger.debug(`Removed ${removedCount} messages after ${messageId}`);
		this.emit();
	}

	clear(): void {
		this.messages = [];
		this.sessionStartTime = new Date();
		this.conversationRecord = null;
		this.emit();
	}

	private isStaleMessage(messageId: string): boolean {
		// Consider messages with run- prefix as potentially stale if session was reset recently
		if (messageId.startsWith('run-')) {
			const timeSinceReset = Date.now() - this.sessionStartTime.getTime();
			// If session was reset within last 5 seconds, consider run- messages as stale
			return timeSinceReset < 5000;
		}
		return false;
	}

	// Notify subscribers
	private snapshot(): ChatStateSnapshot {
		return {
			threadId: this.threadId,
			messages: this.messages,
			tokenUsage: this.tokenUsage,
			conversationRecord: this.conversationRecord
		};
	}

	private emit(): void {
		const snapshot = this.snapshot();
		this.subscribers.forEach((fn) => fn(snapshot));
	}
}
