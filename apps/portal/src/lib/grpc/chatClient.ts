import { createLogger } from '@obp/shared/utils';
const logger = createLogger('ChatGrpcClient');

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { resolveGrpcHost } from '@obp/shared/obp';

const PROTO_PATH = path.join(process.cwd(), 'proto', 'chat.proto');
const GRPC_HOST = resolveGrpcHost(process.env);
const GRPC_AUTH_METADATA_KEY = process.env.OBP_GRPC_AUTH_METADATA_KEY || 'authorization';
// Use {token} as a placeholder for the access token. Default matches HTTP Authorization: Bearer.
const GRPC_AUTH_METADATA_VALUE_TEMPLATE =
	process.env.OBP_GRPC_AUTH_METADATA_VALUE_TEMPLATE || 'Bearer {token}';

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const chatProto = (protoDescriptor.code as any).obp.grpc.chat.g1;

let clientInstance: any = null;

function getClient() {
	if (!clientInstance) {
		logger.info(`>>>>> gRPC >>>>> connecting to chat service at ${GRPC_HOST}`);
		clientInstance = new chatProto.ChatStreamService(
			GRPC_HOST,
			grpc.credentials.createInsecure()
		);
	}
	return clientInstance;
}

export interface ChatMessageEvent {
	event_type: string;
	chat_message_id: string;
	chat_room_id: string;
	sender_user_id: string;
	sender_consumer_id: string;
	sender_username: string;
	sender_provider: string;
	sender_consumer_name: string;
	content: string;
	message_type: string;
	mentioned_user_ids: string[];
	reply_to_message_id: string;
	thread_id: string;
	is_deleted: boolean;
	created_at: string;
	updated_at: string;
}

/**
 * Stream messages for a chat room. Returns a gRPC readable stream.
 * If an accessToken is provided, it is sent as the `authorization` metadata header.
 */
export function streamMessages(chatRoomId: string, accessToken?: string) {
	const client = getClient();
	const metadata = new grpc.Metadata();
	if (accessToken) {
		const value = GRPC_AUTH_METADATA_VALUE_TEMPLATE.replace('{token}', accessToken);
		metadata.set(GRPC_AUTH_METADATA_KEY, value);
	}
	return client.StreamMessages({ chat_room_id: chatRoomId }, metadata);
}

/**
 * Serialize a gRPC timestamp to ISO string.
 */
export function formatTimestamp(ts: any): string {
	// The OBP-API gRPC server currently sends created_at/updated_at as null
	// (see ChatStreamServiceImpl.jsonToChatMessageEvent). Since the event has
	// just been received, fall back to "now" — accurate for live-streamed messages.
	if (!ts) return new Date().toISOString();
	if (typeof ts === 'string') return ts;
	const seconds = parseInt(ts.seconds || '0', 10);
	const nanos = ts.nanos || 0;
	return new Date(seconds * 1000 + nanos / 1_000_000).toISOString();
}

/**
 * Convert a gRPC ChatMessageEvent to a plain object matching the REST API shape.
 */
export function formatMessageEvent(event: any): ChatMessageEvent {
	return {
		event_type: event.event_type || 'new',
		chat_message_id: event.chat_message_id,
		chat_room_id: event.chat_room_id,
		sender_user_id: event.sender_user_id,
		sender_consumer_id: event.sender_consumer_id,
		sender_username: event.sender_username,
		sender_provider: event.sender_provider,
		sender_consumer_name: event.sender_consumer_name,
		content: event.content,
		message_type: event.message_type,
		mentioned_user_ids: event.mentioned_user_ids || [],
		reply_to_message_id: event.reply_to_message_id,
		thread_id: event.thread_id,
		is_deleted: event.is_deleted,
		created_at: formatTimestamp(event.created_at),
		updated_at: formatTimestamp(event.updated_at)
	};
}
