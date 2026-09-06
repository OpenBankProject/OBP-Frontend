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
// Components
export {
	OpeyChat,
	ChatMessage,
	ConsentCard,
	LegalDocumentModal,
	LightSwitch,
	NavigationSidebar,
	Toast,
	ToolApprovalCard,
	ToolMessage,
	ToolError,
	ObpApiResponse,
	DefaultToolResponse
} from './components/index.js';

// OBP API
export { OBPRequests, createOBPRequests } from './obp/index.js';
export { OBPErrorBase, OBPRequestError, OBPRateLimitError, OBPTimeoutError, obpErrorResponse } from './obp/index.js';

// Opey
export { ChatController, SessionController, ChatState, SessionState, RestChatService, OpeySessionService, CookieAuthStrategy } from './opey/index.js';

// Utils
export { createLogger, toaster, toast, getLegalMarkdownFromWebUIProps, extractUsernameFromJWT } from './utils/index.js';

// Stores
export { currentBank } from './stores/index.js';

// Health Check
export { HealthCheckRegistry, healthCheckRegistry, HealthCheckService, HealthCheckState } from './health-check/index.js';

// Markdown
export { renderMarkdown } from './markdown/index.js';

// Config
export { buildMyAccountItems, getActiveMenuItem } from './config/index.js';
export type { NavigationSection } from './config/index.js';
