/**
 * The app's server-side Opey proxy: the one place every Opey call from the browser passes
 * through, whichever page embeds the chat. The browser never talks to Opey directly.
 *
 * Besides forwarding, the stream handlers tee Opey's server-sent events: the bytes go to
 * the browser untouched while a collector picks out the messages that completed, and once
 * Opey is done the turn is merged into the user's row in the app's conversation entity,
 * as the logged-in user. The outcome is appended to the stream as a `conversation_recorded`
 * event so the chat can say whether it is being saved.
 *
 * Anonymous Opey sessions pass through unrecorded. Only Opey's own session cookie is
 * forwarded; the app's session cookie never reaches Opey.
 */
import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { createLogger } from '../../utils/logger.js';
import {
	ConversationRowStore,
	SseTranscriptCollector,
	consentIdFromJwt,
	consentJwtFromBody,
	resolveConsentReferenceId,
	type ConversationObpRequests,
	type ConversationRecordOutcome
} from '../../opey/recording/index.js';
import { pageFromReferer } from '../../opey/utils/conversationRecord.js';

const logger = createLogger('OpeyProxy');

export interface OpeyProxyRecordingConfig {
	/** Personal dynamic entity this app records conversations into, e.g. obp_portal_opey_conversation. */
	entityName: string;
	/** The app's OBP request helper; calls run as the logged-in user. */
	obpRequests: ConversationObpRequests;
}

export interface OpeyProxyConfig {
	/** Base URL of the Opey service; read per request so env changes are seen. Unset means 503. */
	opeyBaseUrl: () => string | undefined;
	/** The logged-in user's OBP access token, or undefined for an anonymous visitor. */
	getAccessToken: (event: RequestEvent) => string | undefined;
	/** Refuse requests without a logged-in user with 401. Default false: anonymous sessions pass through, unrecorded. */
	requireUser?: boolean;
	/** Record each turn into a conversation entity. Unset means the proxy only forwards. */
	recording?: OpeyProxyRecordingConfig;
	/** Name of Opey's session cookie, the only cookie forwarded. Default 'session'. */
	opeyCookieName?: string;
	fetchImpl?: typeof fetch;
}

export interface OpeyProxyHandlers {
	/** POST /backend/opey/stream */
	stream: { POST: RequestHandler };
	/** POST /backend/opey/stream/[threadId]/regenerate?message_id= */
	regenerate: { POST: RequestHandler };
	/** POST /backend/opey/stream/[threadId]/stop */
	stop: { POST: RequestHandler };
	/** POST /backend/opey/invoke (one-shot, no thread; not recorded) */
	invoke: { POST: RequestHandler };
	/** GET /backend/opey/status */
	status: { GET: RequestHandler };
	/** GET /backend/opey/mermaid_diagram */
	mermaidDiagram: { GET: RequestHandler };
}

const SSE_HEADERS = {
	'Content-Type': 'text/event-stream',
	'Cache-Control': 'no-cache, no-transform',
	Connection: 'keep-alive',
	'X-Accel-Buffering': 'no'
};

/** Pick one cookie out of a Cookie header. */
export function pickCookie(cookieHeader: string | null, name: string): string | undefined {
	if (!cookieHeader) return undefined;
	for (const part of cookieHeader.split(';')) {
		const trimmed = part.trim();
		if (trimmed.startsWith(`${name}=`)) return trimmed;
	}
	return undefined;
}

/** The SSE line the proxy appends once the turn has been recorded. */
export function conversationRecordedEvent(entityName: string, outcome: ConversationRecordOutcome): string {
	const event: Record<string, unknown> = { type: 'conversation_recorded', status: outcome.status, entity_name: entityName };
	if (outcome.status === 'saved') {
		event.record_id = outcome.recordId;
		event.message_count = outcome.messageCount;
	} else if (outcome.status !== 'skipped') {
		event.detail = outcome.detail;
	}
	return `data: ${JSON.stringify(event)}\n\n`;
}

/** Route params are typed per app; the shared handler reads the one it needs by name. */
function threadIdParam(event: RequestEvent): string {
	const value = (event.params as Record<string, string | undefined>).threadId;
	return typeof value === 'string' ? value : '';
}

interface TurnRecording {
	threadId: string;
	accessToken: string;
	consentJwt: string | null;
	truncateAfterMessageId?: string;
	/** Page the chat is embedded in, from the request's Referer. */
	page: string;
}

export function createOpeyProxyHandlers(config: OpeyProxyConfig): OpeyProxyHandlers {
	const { opeyBaseUrl, getAccessToken, requireUser = false, recording, opeyCookieName = 'session' } = config;
	const fetchImpl = config.fetchImpl ?? ((input, init) => fetch(input, init));
	const store = recording ? new ConversationRowStore(recording.entityName, recording.obpRequests) : null;

	function unconfigured(): Response {
		logger.error('OPEY_BASE_URL is not configured; cannot proxy to Opey');
		return json({ message: 'Opey is not configured on this server (OPEY_BASE_URL is unset).', code: 503 }, { status: 503 });
	}

	function unauthorized(): Response {
		return json({ message: 'Unauthorized: please log in.', code: 401 }, { status: 401 });
	}

	function upstreamHeaders(event: RequestEvent, extra: Record<string, string> = {}): Record<string, string> {
		const headers: Record<string, string> = { ...extra };
		const cookie = pickCookie(event.request.headers.get('cookie'), opeyCookieName);
		if (cookie) headers['Cookie'] = cookie;
		return headers;
	}

	/** Pass an Opey error body back with its status, as JSON. */
	async function passthroughError(upstream: Response): Promise<Response> {
		const text = await upstream.text().catch(() => '');
		const headers: Record<string, string> = { 'Content-Type': upstream.headers.get('content-type') || 'application/json' };
		return new Response(text, { status: upstream.status, headers });
	}

	function upstreamFailure(what: string, err: unknown): Response {
		logger.error(`Opey ${what} request failed:`, err);
		return json({ message: `Could not reach Opey: ${err instanceof Error ? err.message : String(err)}`, code: 502 }, { status: 502 });
	}

	/** Write the turn as the user. Never throws; a null result means there was nothing to say. */
	async function recordTurn(turn: TurnRecording, collector: SseTranscriptCollector): Promise<ConversationRecordOutcome | null> {
		if (!store || !recording) return null;
		collector.end();
		const messages = collector.completed();
		const consentReferenceIds: string[] = [];
		if (turn.consentJwt) {
			const consentId = consentIdFromJwt(turn.consentJwt);
			const ref = consentId ? await resolveConsentReferenceId(recording.obpRequests.get, turn.accessToken, consentId) : null;
			if (ref) consentReferenceIds.push(ref);
		}
		if (messages.length === 0 && consentReferenceIds.length === 0 && !turn.truncateAfterMessageId) return null;
		try {
			return await store.append({
				accessToken: turn.accessToken,
				threadId: turn.threadId,
				messages,
				consentReferenceIds,
				truncateAfterMessageId: turn.truncateAfterMessageId,
				page: turn.page
			});
		} catch (err) {
			logger.warn('Conversation recording threw unexpectedly:', err);
			return { status: 'error', detail: err instanceof Error ? err.message : String(err) };
		}
	}

	/**
	 * Relay Opey's SSE body chunk by chunk (no buffering), feeding the collector on the way.
	 * When Opey finishes, the turn is recorded and the outcome appended before the stream
	 * closes. A client that goes away mid-turn still gets what completed recorded.
	 */
	function relaySse(upstream: Response, turn: TurnRecording | null): Response {
		const reader = upstream.body!.getReader();
		const collector = new SseTranscriptCollector();
		const encoder = new TextEncoder();
		let finished = false;

		const finish = async (): Promise<ConversationRecordOutcome | null> => {
			if (finished || !turn) return null;
			finished = true;
			return recordTurn(turn, collector);
		};

		const stream = new ReadableStream<Uint8Array>({
			async pull(controller) {
				const { done, value } = await reader.read();
				if (done) {
					const outcome = await finish();
					if (outcome && outcome.status !== 'skipped' && recording) {
						controller.enqueue(encoder.encode(conversationRecordedEvent(recording.entityName, outcome)));
					}
					controller.close();
					return;
				}
				if (turn) collector.feed(value);
				controller.enqueue(value);
			},
			cancel() {
				reader.cancel().catch(() => undefined);
				void finish();
			}
		});

		const headers = new Headers(SSE_HEADERS);
		const setCookie = upstream.headers.get('set-cookie');
		if (setCookie) headers.set('Set-Cookie', setCookie);
		const threadIdHeader = upstream.headers.get('X-Thread-ID');
		if (threadIdHeader) headers.set('X-Thread-ID', threadIdHeader);
		return new Response(stream, { status: upstream.status, headers });
	}

	function turnFor(event: RequestEvent, accessToken: string | undefined, threadId: string, extra: Partial<TurnRecording> = {}): TurnRecording | null {
		if (!store || !accessToken || !threadId) return null;
		return { threadId, accessToken, consentJwt: null, page: pageFromReferer(event.request.headers.get('referer')), ...extra };
	}

	const stream: RequestHandler = async (event) => {
		const base = opeyBaseUrl();
		if (!base) return unconfigured();
		const accessToken = getAccessToken(event);
		if (requireUser && !accessToken) return unauthorized();

		const bodyText = await event.request.text();
		let body: any = null;
		try {
			body = JSON.parse(bodyText);
		} catch {
			/* Opey will reject it with a 422 */
		}

		let upstream: Response;
		try {
			upstream = await fetchImpl(`${base}/stream`, {
				method: 'POST',
				headers: upstreamHeaders(event, { 'Content-Type': 'application/json', Accept: 'text/event-stream' }),
				body: bodyText
			});
		} catch (err) {
			return upstreamFailure('stream', err);
		}
		if (!upstream.ok || !upstream.body) return passthroughError(upstream);

		const threadId = upstream.headers.get('X-Thread-ID') || (typeof body?.thread_id === 'string' ? body.thread_id : '');
		return relaySse(upstream, turnFor(event, accessToken, threadId, { consentJwt: consentJwtFromBody(body) }));
	};

	const regenerate: RequestHandler = async (event) => {
		const base = opeyBaseUrl();
		if (!base) return unconfigured();
		const accessToken = getAccessToken(event);
		if (requireUser && !accessToken) return unauthorized();

		const threadId = threadIdParam(event);
		const messageId = event.url.searchParams.get('message_id') ?? '';
		const url = new URL(`${base}/stream/${encodeURIComponent(threadId)}/regenerate`);
		if (messageId) url.searchParams.set('message_id', messageId);

		let upstream: Response;
		try {
			upstream = await fetchImpl(url, {
				method: 'POST',
				headers: upstreamHeaders(event, { 'Content-Type': 'application/json', Accept: 'text/event-stream' })
			});
		} catch (err) {
			return upstreamFailure('regenerate', err);
		}
		if (!upstream.ok || !upstream.body) return passthroughError(upstream);

		const resolvedThread = upstream.headers.get('X-Thread-ID') || threadId;
		return relaySse(upstream, turnFor(event, accessToken, resolvedThread, { truncateAfterMessageId: messageId || undefined }));
	};

	const stop: RequestHandler = async (event) => {
		const base = opeyBaseUrl();
		if (!base) return unconfigured();
		if (requireUser && !getAccessToken(event)) return unauthorized();
		const threadId = threadIdParam(event);
		try {
			const upstream = await fetchImpl(`${base}/stream/${encodeURIComponent(threadId)}/stop`, {
				method: 'POST',
				headers: upstreamHeaders(event)
			});
			const data = await upstream.json().catch(() => ({}));
			return json(data, { status: upstream.status });
		} catch (err) {
			return upstreamFailure('stop', err);
		}
	};

	/**
	 * One-shot call with no thread (the Insight Bar uses it for page hints). Not recorded:
	 * these are automated, not something the user wrote, and would flood My Data.
	 */
	const invoke: RequestHandler = async (event) => {
		const base = opeyBaseUrl();
		if (!base) return unconfigured();
		if (requireUser && !getAccessToken(event)) return unauthorized();
		const bodyText = await event.request.text();
		try {
			const upstream = await fetchImpl(`${base}/invoke`, {
				method: 'POST',
				headers: upstreamHeaders(event, { 'Content-Type': 'application/json' }),
				body: bodyText
			});
			if (!upstream.ok) {
				const errorText = await upstream.text().catch(() => '');
				logger.warn(`Opey invoke failed: ${upstream.status} ${errorText}`);
				return json({ message: errorText || upstream.statusText, code: upstream.status }, { status: upstream.status });
			}
			const result = await upstream.json();
			const headers: Record<string, string> = {};
			const setCookie = upstream.headers.get('set-cookie');
			if (setCookie) headers['Set-Cookie'] = setCookie;
			return json(result, { headers });
		} catch (err) {
			return upstreamFailure('invoke', err);
		}
	};

	/** Opey's own /status, so the chat's connection pip and the status page need no direct route to Opey. */
	const status: RequestHandler = async () => {
		const base = opeyBaseUrl();
		if (!base) return unconfigured();
		try {
			const upstream = await fetchImpl(`${base}/status`, {
				headers: { Accept: 'application/json' },
				signal: AbortSignal.timeout(5000)
			});
			const text = await upstream.text();
			return new Response(text, {
				status: upstream.status,
				headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' }
			});
		} catch (err) {
			return upstreamFailure('status', err);
		}
	};

	const mermaidDiagram: RequestHandler = async (event) => {
		const base = opeyBaseUrl();
		if (!base) return unconfigured();
		try {
			const upstream = await fetchImpl(`${base}/mermaid_diagram`, { headers: upstreamHeaders(event) });
			return new Response(upstream.body, {
				status: upstream.status,
				headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream' }
			});
		} catch (err) {
			return upstreamFailure('mermaid_diagram', err);
		}
	};

	return {
		stream: { POST: stream },
		regenerate: { POST: regenerate },
		stop: { POST: stop },
		invoke: { POST: invoke },
		status: { GET: status },
		mermaidDiagram: { GET: mermaidDiagram }
	};
}
