// Controllers
export { ChatController } from './controllers/ChatController.js';
export { SessionController } from './controllers/SessionController.js';
export { ToolCallController } from './controllers/ToolCallController.js';
export type { ToolCallApprover } from './controllers/ToolCallController.js';

// Services
export { CookieAuthStrategy } from './services/AuthStrategy.js';
export type { AuthStrategy } from './services/AuthStrategy.js';
export type { ChatService, StreamEvent } from './services/ChatService.js';
export { OpeySessionService } from './services/OpeySessionService.js';
export { RestChatService } from './services/RestChatService.js';
export type { SessionService } from './services/SessionService.js';

// State
export { ChatState } from './state/ChatState.js';
export type { ChatStateSnapshot } from './state/ChatState.js';
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
