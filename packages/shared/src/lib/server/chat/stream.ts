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
import { createLogger } from '$shared/utils/logger';

const logger = createLogger('ChatStreamAPI');

/** A live stream of a room's message events (the Portal's gRPC client fits); data, error and end like a Node stream. */
export interface ChatEventStream {
	on(event: 'data', listener: (event: any) => void): unknown;
	on(event: 'error', listener: (err: any) => void): unknown;
	on(event: 'end', listener: () => void): unknown;
	cancel(): void;
}

export interface ChatStreamConfig {
	/** Open the stream of a room's events with the User's token. */
	openStream: (chatRoomId: string, accessToken?: string) => ChatEventStream;
	/** One event as the REST API's message shape. */
	formatEvent: (event: any) => { chat_message_id: string; event_type: string; created_at: string };
}

type StreamEvent = {
	locals: { session?: { data?: { user?: unknown; oauth?: { access_token?: string } } } | null };
	params: Partial<Record<string, string>>;
};

/**
 * GET handler for a room's live messages as server-sent events: each event from the stream is one `data:` frame, and
 * a failure is a `transport-error` event, after which the page falls back to polling.
 */
export function createChatStreamHandler({ openStream, formatEvent }: ChatStreamConfig) {
	return async ({ locals, params }: StreamEvent): Promise<Response> => {
		const session = locals.session;
		if (!session?.data?.user) {
			return new Response(JSON.stringify({ message: 'Unauthorized', code: 401 }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		const chatRoomId = params.chatRoomId ?? '';
		const accessToken = session.data.oauth?.access_token;
		let grpcStream: ChatEventStream | undefined;

		const stream = new ReadableStream({
			start(controller) {
				const encoder = new TextEncoder();

				logger.info(`>>>>> gRPC >>>>> opening stream for room ${chatRoomId}`);

				// Kick-start the SSE stream with a comment frame so the HTTP
				// adapter flushes response headers to the client immediately.
				// Without this, the browser's EventSource stays in CONNECTING
				// and never fires `onopen` until a real gRPC event arrives.
				// SSE comments start with `:` and are ignored by the client.
				controller.enqueue(encoder.encode(':ok\n\n'));

				try {
					grpcStream = openStream(chatRoomId, accessToken);
				} catch (err: any) {
					logger.error(`>>>>> gRPC >>>>> FAILED to open stream:`, err);
					try {
						const reason = err?.message || 'Failed to open gRPC stream';
						controller.enqueue(encoder.encode(`event: transport-error\ndata: ${JSON.stringify({ reason })}\n\n`));
					} catch {
						// ignore
					}
					controller.close();
					return;
				}

				grpcStream.on('data', (event: any) => {
					try {
						const message = formatEvent(event);
						logger.info(`>>>>> gRPC >>>>> message received for room ${chatRoomId} (id=${message.chat_message_id}, type=${message.event_type})`);
						controller.enqueue(encoder.encode(`data: ${JSON.stringify(message)}\n\n`));
					} catch (err) {
						logger.error(`>>>>> gRPC >>>>> error formatting message event:`, err);
					}
				});

				grpcStream.on('error', (err: any) => {
					logger.error(`>>>>> gRPC >>>>> STREAM ERROR:`, err.message);
					try {
						const reason = err?.code !== undefined ? `${err.message} (code ${err.code})` : err?.message || 'gRPC stream error';
						controller.enqueue(encoder.encode(`event: transport-error\ndata: ${JSON.stringify({ reason })}\n\n`));
						controller.close();
					} catch {
						// Controller may already be closed
					}
				});

				grpcStream.on('end', () => {
					logger.info(`>>>>> gRPC >>>>> stream ended for room ${chatRoomId}`);
					try {
						controller.close();
					} catch {
						// Already closed
					}
				});
			},
			cancel() {
				logger.info(`>>>>> gRPC >>>>> client disconnected, cancelling stream for room ${chatRoomId}`);
				grpcStream?.cancel();
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	};
}
