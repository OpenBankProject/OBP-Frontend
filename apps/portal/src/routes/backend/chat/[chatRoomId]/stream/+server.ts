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
import type { RequestHandler } from './$types';
import { streamMessages, formatMessageEvent } from '$lib/grpc/chatClient';
import { createLogger } from '@obp/shared/utils';

const logger = createLogger('ChatStreamAPI');

export const GET: RequestHandler = async ({ locals, params }) => {
	const session = locals.session;
	if (!session?.data?.user) {
		return new Response(JSON.stringify({ message: 'Unauthorized', code: 401 }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const chatRoomId = params.chatRoomId;
	const accessToken = session.data.oauth?.access_token;
	let grpcStream: any;

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
				grpcStream = streamMessages(chatRoomId, accessToken);
			} catch (err: any) {
				logger.error(`>>>>> gRPC >>>>> FAILED to open stream:`, err);
				try {
					const reason = err?.message || 'Failed to open gRPC stream';
					const data = `event: transport-error\ndata: ${JSON.stringify({ reason })}\n\n`;
					controller.enqueue(encoder.encode(data));
				} catch {
					// ignore
				}
				controller.close();
				return;
			}

			grpcStream.on('data', (event: any) => {
				try {
					logger.info(`>>>>> gRPC >>>>> raw event.created_at = ${JSON.stringify(event.created_at)}`);
					const message = formatMessageEvent(event);
					logger.info(`>>>>> gRPC >>>>> formatted created_at = ${message.created_at}`);
					logger.info(`>>>>> gRPC >>>>> message received for room ${chatRoomId} (id=${message.chat_message_id}, type=${message.event_type})`);
					const data = `data: ${JSON.stringify(message)}\n\n`;
					controller.enqueue(encoder.encode(data));
				} catch (err) {
					logger.error(`>>>>> gRPC >>>>> error formatting message event:`, err);
				}
			});

			grpcStream.on('error', (err: any) => {
				logger.error(`>>>>> gRPC >>>>> STREAM ERROR:`, err.message);
				try {
					const reason = err?.code !== undefined
						? `${err.message} (code ${err.code})`
						: err?.message || 'gRPC stream error';
					const data = `event: transport-error\ndata: ${JSON.stringify({ reason })}\n\n`;
					controller.enqueue(encoder.encode(data));
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
			if (grpcStream) {
				grpcStream.cancel();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		}
	});
};
