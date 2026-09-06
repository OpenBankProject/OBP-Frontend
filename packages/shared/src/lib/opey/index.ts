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
// Controllers
export { ChatController } from './controllers/ChatController.js';
export { SessionController } from './controllers/SessionController.js';
export { ToolCallController } from './controllers/ToolCallController.js';
export type { ToolCallApprover } from './controllers/ToolCallController.js';

// Services
export { CookieAuthStrategy } from './services/AuthStrategy.js';
export type { AuthStrategy } from './services/AuthStrategy.js';
export type { ChatService, StreamEvent, ConversationRecordStatus } from './services/ChatService.js';
export { OpeySessionService } from './services/OpeySessionService.js';
export { RestChatService } from './services/RestChatService.js';
export type { SessionService } from './services/SessionService.js';

// State
export { ChatState } from './state/ChatState.js';
export type { ChatStateSnapshot, ConversationRecordInfo } from './state/ChatState.js';

// Conversation recording (driven from the app's server-side Opey proxy)
export { SseTranscriptCollector, ConversationRowStore } from './recording/index.js';
export type { ConversationObpRequests, ConversationRecordOutcome } from './recording/index.js';
export { SessionState } from './state/SessionState.js';
export type { SessionSnapshot } from './state/SessionState.js';

// Utils
export { expandRoleRequirements, pickConsentRole, pickConsentEntitlement, deduplicateRoles, selectConsentEntitlements, narrowestRoles, forbiddenConsentRoles, CONSENT_FORBIDDEN_ROLES } from './utils/roles.js';
export type { StoredEntitlement, ConsentEntitlementSelection } from './utils/roles.js';
export { chatToMarkdown, messageToMarkdown } from './utils/chatToMarkdown.js';
export {
	getSelectedConsentViews,
	setSelectedConsentViews,
	clearSelectedConsentViews
} from './utils/consentScope.js';
export type { ConsentViewSelection } from './utils/consentScope.js';

// Types
export type {
	Role,
	BaseMessage,
	UserMessage,
	AssistantMessage,
	ErrorMessage,
	ToolMessage,
	ToolCall,
	ClientToolHandler,
	ClientToolOutcome
} from './types.js';
export {
	summariseConsentJwt,
	addGrantedConsent,
	activeConsents,
	consentsCover,
	setConsentReferenceId
} from './utils/consentSummary.js';
export type { GrantedConsentSummary, ConsentEntitlement, ConsentView } from './utils/consentSummary.js';
export {
	PORTAL_OPEY_CONVERSATION_ENTITY,
	MANAGER_OPEY_CONVERSATION_ENTITY,
	PORTAL_OPEY_CONVERSATION_ENTITY_NAME,
	MANAGER_OPEY_CONVERSATION_ENTITY_NAME
} from './conversationEntities';
