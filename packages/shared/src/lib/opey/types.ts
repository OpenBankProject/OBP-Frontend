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

/** One personal dynamic entity a consent lists: bank_id '' for system level; actions read/write. */
export interface ConsentPersonalDynamicEntity {
	bank_id: string;
	entity_name: string;
	actions: string[];
}

/**
 * The OBP consent `my_resources` block: the user's own personal resources the consent
 * user may act on for them. Owned, not granted: no entitlement is involved, and the
 * consent card never shows a "not held" state for these.
 */
export interface ConsentMyResources {
	personal_dynamic_entities?: ConsentPersonalDynamicEntity[];
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
	consentAccountId?: string; // Account ID for account/view-scoped consent
	consentViewId?: string; // View ID for view-scoped consent
	consentRequiresViewAccess?: boolean; // True when the endpoint is gated by account-access-to-a-view
	consentIsUserScoped?: boolean; // True when the endpoint is identity-bound (e.g. /my/*)
	consentMyResources?: ConsentMyResources; // The user's own resources the consent must list (OBP my_resources)
	// Client-executed tool fields (for client_tool_call events, e.g. set_form_fields)
	clientExecuted?: boolean; // True when this tool runs in the browser, not on the server
	clientResult?: ClientToolOutcome; // Outcome of the local execution, for rendering
}

/**
 * Outcome of executing a client tool in the browser. `status` mirrors what is
 * reported back to Opey; everything else is tool-specific display data
 * (e.g. set_form_fields adds `applied` and `ignored` field-name lists).
 */
export interface ClientToolOutcome {
	status: 'applied' | 'rejected' | 'error';
	error?: string;
	[key: string]: unknown;
}

/**
 * Executes one client tool locally (e.g. writes values into a form) and
 * resolves with the result payload reported back to Opey. Throw to report
 * failure — the controller converts it into a status:"error" result so the
 * graph never hangs.
 */
export type ClientToolHandler = (
	toolInput: Record<string, any>
) => Promise<object | undefined>;

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
