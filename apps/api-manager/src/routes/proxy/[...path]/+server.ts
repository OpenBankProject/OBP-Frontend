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
import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/public";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("Proxy");

const TIMEOUT_MS = 15_000;

/**
 * Generic catch-all proxy for OBP API.
 *
 * Forwards the request to OBP with the OAuth token added,
 * and streams the response back unchanged.
 *
 * The URL path after /proxy/ is the exact OBP API path.
 * e.g. /proxy/obp/v6.0.0/banks → ${OBP_BASE_URL}/obp/v6.0.0/banks
 */
export const fallback: RequestHandler = async ({ params, request, locals, url }) => {
	const session = locals.session;

	if (!session?.data?.user) {
		return new Response(JSON.stringify({ message: "Unauthorized" }), {
			status: 401,
			headers: { "content-type": "application/json" },
		});
	}

	const sessionOAuth = SessionOAuthHelper.getSessionOAuth(session);
	const accessToken = sessionOAuth?.accessToken;

	if (!accessToken) {
		return new Response(JSON.stringify({ message: "No API access token available" }), {
			status: 401,
			headers: { "content-type": "application/json" },
		});
	}

	const obpPath = params.path ?? '';

	// Reject path-traversal and absolute-URL attempts before joining into the OBP URL.
	if (
		obpPath === '' ||
		obpPath.includes('..') ||
		obpPath.startsWith('/') ||
		obpPath.includes('://') ||
		obpPath.includes('\0')
	) {
		logger.warn(`Rejected proxy path: ${obpPath}`);
		return new Response(JSON.stringify({ message: "Invalid path" }), {
			status: 400,
			headers: { "content-type": "application/json" },
		});
	}

	const queryString = url.search;
	const obpUrl = `${env.PUBLIC_OBP_BASE_URL}/${obpPath}${queryString}`;

	const headers: Record<string, string> = {
		Authorization: `Bearer ${accessToken}`,
	};

	// Forward content-type if present (for POST/PUT/PATCH)
	const contentType = request.headers.get("content-type");
	if (contentType) {
		headers["Content-Type"] = contentType;
	}

	const fetchOptions: RequestInit = {
		method: request.method,
		headers,
	};

	// Forward body for methods that have one
	let requestBody: string | undefined;
	if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
		requestBody = await request.text();
		fetchOptions.body = requestBody;
	}

	const startTime = performance.now();

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
	fetchOptions.signal = controller.signal;

	let obpResponse: Response;
	try {
		obpResponse = await fetch(obpUrl, fetchOptions);
	} catch (error: any) {
		if (error.name === 'AbortError') {
			logger.error(`Timeout: ${request.method} /${obpPath}`);
			return new Response(JSON.stringify({ message: `Request to ${obpPath} timed out` }), {
				status: 504,
				headers: { "content-type": "application/json" },
			});
		}
		logger.error(`Error: ${request.method} /${obpPath}:`, error);
		return new Response(JSON.stringify({ message: error.message || 'Bad Gateway' }), {
			status: 502,
			headers: { "content-type": "application/json" },
		});
	} finally {
		clearTimeout(timeout);
	}

	const duration = performance.now() - startTime;
	const correlationId = obpResponse.headers.get("Correlation-Id") || "";

	logger.info(
		`${request.method} /${obpPath} → ${obpResponse.status} (${duration.toFixed(0)}ms)${correlationId ? ` [${correlationId}]` : ""}`,
	);

	if (duration > 400) {
		logger.warn(`Slow request: ${request.method} /${obpPath} took ${duration.toFixed(0)}ms`);
	}

	// Log full request/response details on non-2xx responses
	if (!obpResponse.ok) {
		const responseBodyText = await obpResponse.text();

		const loggableHeaders: Record<string, string> = { ...headers };
		if (loggableHeaders["Authorization"]) {
			const token = loggableHeaders["Authorization"];
			loggableHeaders["Authorization"] = token.length > 30
				? `${token.substring(0, 20)}...[truncated]`
				: token;
		}

		logger.warn(`Request failed — details:
  URL:     ${obpUrl}
  Method:  ${request.method}
  Headers: ${JSON.stringify(loggableHeaders, null, 2)}
  Body:    ${requestBody ? requestBody : "(none)"}
  ----
  Status:  ${obpResponse.status}
  Response: ${responseBodyText}`);

		return new Response(responseBodyText, {
			status: obpResponse.status,
			headers: {
				"content-type": obpResponse.headers.get("content-type") || "application/json",
				...(correlationId ? { "Correlation-Id": correlationId } : {}),
			},
		});
	}

	// Stream the OBP response back unchanged
	return new Response(obpResponse.body, {
		status: obpResponse.status,
		headers: {
			"content-type": obpResponse.headers.get("content-type") || "application/json",
			...(correlationId ? { "Correlation-Id": correlationId } : {}),
		},
	});
};
