import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/public";
import { SessionOAuthHelper } from "$lib/oauth/sessionHelper";
import { createLogger } from '@obp/shared/utils';

const logger = createLogger("Proxy");

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

	const obpPath = params.path;
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

	const obpResponse = await fetch(obpUrl, fetchOptions);

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
