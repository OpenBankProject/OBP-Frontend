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
import { createObpProxyHandler, type ObpProxyRequestEvent } from '$shared/server/obp/obpProxy';
import { chatApiPaths, type ChatScope } from '$shared/chat/paths';

/**
 * Whether the browser may call this OBP path through an app's chat proxy: only the scope's own chat rooms (and
 * everything under them) and the User's read markers. A path is as the proxy's rest parameter, without /obp.
 */
export function chatProxyAllows(scope: ChatScope, path: string): boolean {
	const paths = chatApiPaths(scope);
	const rooms = paths.rooms.replace(/^\/obp\//, '');
	const readMarker = /^v6\.0\.0\/users\/current\/chat-rooms\/[^/]+\/read-marker$/;
	return path.startsWith(`${rooms}/`) || readMarker.test(path);
}

/**
 * The proxy for an app's chat pages in the browser (messages, reactions, read markers), for an app with no general
 * OBP proxy: the User's own token, and only the scope's chat paths (/{prefix}/obp/[...path]).
 */
export function createChatProxyHandler(obpBaseUrl: string, scope: ChatScope) {
	const forward = createObpProxyHandler(obpBaseUrl);
	return async (event: ObpProxyRequestEvent): Promise<Response> => {
		if (!chatProxyAllows(scope, event.params.path ?? '')) {
			return new Response(JSON.stringify({ code: 403, message: 'Not a chat path of this app' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		return forward(event);
	};
}
