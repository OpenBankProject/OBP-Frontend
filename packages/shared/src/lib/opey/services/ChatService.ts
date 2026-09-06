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
import type { ConsentMyResources } from '../types';
/**
 * Base Interface for chat services. Used to create implementations like RestChatService or WebSocketChatService.
 * 
 */

import type { UserMessage, AssistantMessage, ToolMessage } from '../types'

// Only modify if there is some base logic that needs to be shared across all chat services.
// Else just create a new implementation of ChatService.
export interface ChatService {
    send(msg: UserMessage, threadId?: string): Promise<void>
    sendApproval(toolCallId: string, approved: boolean, threadId: string, approvalLevel?: string): Promise<void>
    sendBatchApproval(decisions: Record<string, { approved: boolean; level: string }>, threadId: string): Promise<void>
    sendConsentResponse(toolCallId: string, consentJwt: string | null, threadId: string, denialReason?: string): Promise<void>
    /** Resume a client_tool_call interrupt with the outcome of the local execution. */
    sendClientToolResult(
        toolCallId: string,
        status: 'applied' | 'rejected' | 'error',
        result: Record<string, unknown>,
        threadId: string
    ): Promise<void>
    regenerate(messageId: string, threadId: string): Promise<void>

    /**
     * Called for streaming events during chat interactions.
     * Handles token-by-token streaming, tool calls, and message lifecycle events.
     */
    onStreamEvent(fn: (event: StreamEvent) => void): void
    onError(fn: (err: Error) => void): void
    cancel(threadId?: string): Promise<void>
}

export type StreamEvent = 
    | { type: 'user_message_confirmed', messageId: string, correlationId: string, content: string, timestamp: number }
    | { type: 'assistant_start', messageId: string, timestamp: Date }
    | { type: 'assistant_token', messageId: string, token: string }
    | { type: 'assistant_complete', messageId: string, usage?: { input_tokens?: number, output_tokens?: number, total_tokens?: number } }
    | { type: 'tool_start', toolCallId: string, toolName: string, toolInput: Record<string, any> }
    | { type: 'tool_token', toolCallId: string, token: string }
    | { type: 'tool_complete', toolCallId: string, toolName: string, toolOutput: any, status: 'success' | 'error' }
    | { 
        type: 'approval_request', 
        toolCallId: string, 
        toolName: string, 
        toolInput: Record<string, any>, 
        message: string,
        riskLevel: string,
        affectedResources: string[],
        reversible: boolean,
        estimatedImpact: string,
        similarOperationsCount: number,
        availableApprovalLevels: string[],
        defaultApprovalLevel: string
      }
    | {
        type: 'batch_approval_request',
        toolCalls: Array<{
          toolCallId: string,
          toolName: string,
          toolInput: Record<string, any>,
          message: string,
          riskLevel: string,
          affectedResources: string[],
          reversible: boolean,
          estimatedImpact: string,
          similarOperationsCount: number,
          availableApprovalLevels: string[],
          defaultApprovalLevel: string,
          operation?: string,
          endpoint?: string,
          method?: string
        }>,
        options: string[]
      }
    | {
        type: 'consent_request',
        toolCallId: string,
        toolName: string,
        operationId: string | null,
        requiredRoles: string[],
        timestamp: number,
        toolCallCount: number,
        bankId?: string | null,
        accountId?: string | null,
        viewId?: string | null,
        requiresViewAccess?: boolean,
        isUserScoped?: boolean,
        myResources?: ConsentMyResources | null
      }
    | { type: 'client_tool_call', toolCallId: string, toolName: string, toolInput: Record<string, any> }
    | { type: 'thread_sync', threadId: string }
    | { type: 'error', messageId?: string, error: string }
    | { type: 'auth_refresh_needed' }
    /**
     * Appended by the app's Opey proxy after it wrote the turn into the user's
     * conversation entity (never sent by Opey itself). Absent when the user is
     * anonymous or the app does not record.
     */
    | { type: 'conversation_recorded', status: ConversationRecordStatus, entityName: string, recordId?: string, messageCount?: number, detail?: string }

export type ConversationRecordStatus = 'saved' | 'unavailable' | 'error'