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
/**
 * This app's Opey proxy: every Opey call from the browser (chat stream, regenerate, stop,
 * invoke, status, diagram) goes through these handlers, whichever page embeds the chat.
 * They also record each turn into the app's conversation entity as the logged-in user.
 * Routes under /backend/opey re-export the handlers; see @obp/shared/server/opey.
 */
import { env } from '$env/dynamic/private';
import { createOpeyProxyHandlers } from '@obp/shared/server/opey';
import { PORTAL_OPEY_CONVERSATION_ENTITY_NAME } from '@obp/shared/opey';
import { obp_requests } from '$lib/obp/requests';

export const opeyProxy = createOpeyProxyHandlers({
	opeyBaseUrl: () => env.OPEY_BASE_URL,
	getAccessToken: (event) => event.locals.session?.data?.oauth?.access_token,
	recording: { entityName: PORTAL_OPEY_CONVERSATION_ENTITY_NAME, obpRequests: obp_requests }
});
