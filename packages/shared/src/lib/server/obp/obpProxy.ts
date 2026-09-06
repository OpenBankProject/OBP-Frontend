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
 * Generic authenticated proxy to the OBP-API, shared by Portal and API Manager.
 *
 * Forwards the request to the OBP-API with the user's OAuth token. The OBP
 * path is taken from the route's rest parameter:
 *   /proxy/obp/v6.0.0/foo → GET {obpBaseUrl}/obp/v6.0.0/foo
 *
 * Responses are passed through unmodified (same status, same JSON body).
 * The app route stays a thin file: it supplies the base URL from its own env
 * and re-exports the handler for each method.
 */

import { createLogger } from '$shared/utils/logger';

const logger = createLogger('OBPProxy');

const TIMEOUT_MS = 15_000;

/** Structural subset of SvelteKit's RequestEvent that the proxy needs. */
export interface ObpProxyRequestEvent {
	locals: {
		session?: {
			data?: { user?: unknown; oauth?: { access_token?: string } };
		} | null;
	};
	params: Partial<Record<string, string>>;
	url: URL;
	request: Request;
}

export interface ObpProxyOptions {
	/**
	 * Supply the OBP auth headers for this request instead of the session's bearer
	 * token (e.g. `Consent-JWT` + `Consumer-Key`). Return null to refuse the request
	 * with 401. The caller must still be logged in to the app.
	 */
	authHeaders?: (event: ObpProxyRequestEvent) => Record<string, string> | null;
	/**
	 * Let visitors without a session through: the request is forwarded with no
	 * Authorization header, so OBP applies its anonymous rules (public endpoints only).
	 * A logged-in visitor's bearer is still attached. For pages served to the public.
	 */
	allowAnonymous?: boolean;
}

export function createObpProxyHandler(obpBaseUrl: string, options: ObpProxyOptions = {}) {
	return async function proxyRequest(event: ObpProxyRequestEvent): Promise<Response> {
		const session = event.locals.session;
		if (!session?.data?.user && !options.allowAnonymous) {
			return new Response(JSON.stringify({ code: 401, message: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		let authHeaders: Record<string, string>;
		if (options.authHeaders) {
			const supplied = options.authHeaders(event);
			if (!supplied) {
				return new Response(JSON.stringify({ code: 401, message: 'No OBP credentials supplied for this request' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			authHeaders = supplied;
		} else {
			const accessToken = session?.data?.oauth?.access_token;
			authHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
		}

		// Reject path-traversal and absolute-URL attempts before joining into the OBP URL.
		const rawPath = event.params.path ?? '';
		if (
			rawPath === '' ||
			rawPath.includes('..') ||
			rawPath.startsWith('/') ||
			rawPath.includes('://') ||
			rawPath.includes('\0')
		) {
			logger.warn(`Rejected proxy path: ${rawPath}`);
			return new Response(JSON.stringify({ code: 400, message: 'Invalid path' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const obpPath = `/obp/${rawPath}`;
		const queryString = event.url.search;
		const url = `${obpBaseUrl}${obpPath}${queryString}`;

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...authHeaders
		};

		const method = event.request.method;
		const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';

		logger.debug(`${method} ${obpPath}`);

		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

		try {
			const fetchOptions: RequestInit = {
				method,
				headers,
				signal: controller.signal
			};

			if (hasBody) {
				fetchOptions.body = await event.request.text();
			}

			const response = await fetch(url, fetchOptions);
			clearTimeout(timeout);

			// Pass through the OBP-API response as-is
			const responseBody = await response.text();

			return new Response(responseBody, {
				status: response.status,
				headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' }
			});
		} catch (error: any) {
			clearTimeout(timeout);
			if (error.name === 'AbortError') {
				logger.error(`Timeout: ${method} ${obpPath}`);
				return new Response(
					JSON.stringify({ code: 504, message: `Request to ${obpPath} timed out` }),
					{ status: 504, headers: { 'Content-Type': 'application/json' } }
				);
			}
			logger.error(`Error: ${method} ${obpPath}:`, error);
			return new Response(JSON.stringify({ code: 502, message: error.message || 'Bad Gateway' }), {
				status: 502,
				headers: { 'Content-Type': 'application/json' }
			});
		}
	};
}
