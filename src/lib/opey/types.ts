// import type { ToolCall as LangChainToolCall } from '@langchain/core/messages/tool'

export type Role = 'user' | 'assistant' | 'tool' | 'error' | 'approval_request';
export interface BaseMessage {
	id: string; // i.e. UUID4
	correlationId?: string; // Temporary ID for optimistic UI updates
	role: Role;
	message: string;
	timestamp: Date; // ISO string
	isStreaming?: boolean;
	isLoading?: boolean; // True when waiting for initial response (before streaming starts)
	isPending?: boolean; // True when waiting for backend to confirm message ID (user messages only)
	error?: string;
	cancelled?: boolean; // True if the message generation was cancelled by user
}

export interface UserMessage extends BaseMessage {
	role: 'user';
	correlationId: string; // correlationId is required for user messages
	// Additional fields specific to user messages can be added here
}
export interface AssistantMessage extends BaseMessage {
	role: 'assistant';
	toolCalls?: ToolCall[];
	// Probably we will need some fields here for tool call/ tool call approval requests
}

export interface ErrorMessage extends BaseMessage {
	role: 'error';
	// Additional fields specific to error messages can be added here
	error: string; // Error message text
}

export interface ToolMessage extends BaseMessage {
	role: 'tool';
	toolName: string; // Name of the tool being called
	toolCallId: string;
	toolInput: Record<string, any>; // Input parameters for the tool call
	status?: 'success' | 'error';
	toolOutput?: any; // Output from the tool call, if available
	instanceNumber?: number; // Instance number for display (e.g., "retrieve_endpoints (2)")
	waitingForApproval?: boolean; // Whether tool is waiting for user approval
	approvalStatus?: 'approved' | 'denied'; // Whether tool was approved or denied by user
	approvalLevel?: string; // The approval level used (e.g., 'auto', 'user', 'admin')
	// Approval metadata from backend
	approvalMessage?: string; // Human-readable description of what the tool will do
	riskLevel?: string;
	affectedResources?: string[];
	reversible?: boolean;
	estimatedImpact?: string;
	similarOperationsCount?: number;
	availableApprovalLevels?: string[];
	defaultApprovalLevel?: string;
	// Consent request fields (for consent_request events)
	waitingForConsent?: boolean; // Whether tool is waiting for user to provide consent JWT
	consentStatus?: 'pending' | 'granted' | 'denied'; // Status of the consent request
	consentOperationId?: string; // OBP API operation that requires consent
	consentRequiredRoles?: string[]; // OBP roles the user must consent to
	consentToolCallCount?: number; // Number of pending tool calls this consent will cover
	consentBankId?: string; // Bank ID for bank-scoped consent roles
}

/**
 * Represents a consent_request event from the backend.
 * Sent when an OBP API tool call returns a consent_required error.
 */
export interface ConsentRequest {
	toolCallId: string;
	toolName: string;
	operationId: string | null;
	requiredRoles: string[];
	timestamp: number;
}

export interface ToolCall {
	id: string;
	name: string;
	args: Record<string, any>;
	status: 'pending' | 'awaiting_approval' | 'error' | 'success'; // LangChainToolCall is a type from the LangChain library
	result?: any; // used for when we have a successful tool call and need to link the result to the tool call
	error?: string;
}
