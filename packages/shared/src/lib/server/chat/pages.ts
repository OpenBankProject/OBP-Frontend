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
 * The chat pages' server side, shared by the Portal (system-wide rooms) and apps with their own rooms at a bank (Cohort):
 * the rooms list and creating a room, one room with its messages, its settings, and joining with a key. Each factory
 * is given the scope (which rooms), the app's OBP requests and where its chat pages are; the app's route files stay thin.
 */
import type { RequestEvent } from '@sveltejs/kit';
import { error, isRedirect, redirect } from '@sveltejs/kit';
import { createLogger } from '$shared/utils/logger';
import { OBPRequestError } from '$shared/obp/errors';
import { chatApiPaths, type ChatScope } from '$shared/chat/paths';

const logger = createLogger('ChatPages');

/** The app's server-side OBP-API requests (both apps' request helpers fit). */
export interface ChatObp {
	get(path: string, token?: string): Promise<any>;
	post(path: string, body: unknown, token?: string): Promise<any>;
	put(path: string, body: unknown, token?: string): Promise<any>;
	delete(path: string, token?: string): Promise<any>;
}

export interface ChatPagesConfig {
	scope: ChatScope;
	obp: ChatObp;
	/** Where the app's chat pages are, e.g. /user/chat. */
	basePath: string;
}

type ChatEvent = Pick<RequestEvent, 'params' | 'url' | 'request'> & {
	locals: { session?: { data?: { user?: { user_id?: string }; oauth?: { access_token?: string } } } | null };
};

const tokenOf = (event: ChatEvent) => event.locals.session?.data?.oauth?.access_token;
const userIdOf = (event: ChatEvent) => event.locals.session?.data?.user?.user_id || '';

function requireToken(event: ChatEvent): string {
	const token = tokenOf(event);
	if (!token) error(401, { message: 'Unauthorized: No access token found in session.' });
	return token;
}

/** The rooms list, with each room's unread count, and the create action. */
export function createChatRoomsPage({ scope, obp }: ChatPagesConfig) {
	const paths = chatApiPaths(scope);
	return {
		async load(event: ChatEvent) {
			const token = requireToken(event);
			try {
				const response = await obp.get(paths.rooms, token);
				const chatRooms = response.chat_rooms || [];
				// The chat-rooms endpoint returns unread_count on each room directly
				const unreadCounts: Record<string, number> = {};
				for (const room of chatRooms) unreadCounts[room.chat_room_id] = room.unread_count || 0;
				return { chatRooms, unreadCounts };
			} catch (e) {
				logger.error('Error fetching chat rooms:', e);
				error(500, { message: 'Could not fetch chat rooms at this time. Please try again later.' });
			}
		},
		actions: {
			create: async (event: ChatEvent) => {
				const token = tokenOf(event);
				if (!token) return { code: 'msg_no_token', message: 'No access token found in session.' };
				const formData = await event.request.formData();
				const name = formData.get('name')?.toString()?.trim();
				const description = formData.get('description')?.toString()?.trim() || '';
				if (!name) return { code: 'msg_name_required', message: 'Chat room name is required.' };
				try {
					const room = await obp.post(paths.rooms, { name, description }, token);
					return { success: true, code: 'msg_created', message: 'Chat room created successfully.', createdRoom: room };
				} catch (err) {
					logger.error('Error creating chat room:', err);
					if (err instanceof OBPRequestError) return { message: err.message };
					return { code: 'msg_create_failed', message: 'Failed to create chat room.' };
				}
			}
		}
	};
}

/** The DEFAULT max message length, when OBP-API does not publish its own (older API). */
export const DEFAULT_MAX_MESSAGE_LENGTH = 10000;

export interface ChatRoomPageConfig extends ChatPagesConfig {
	/** The links that stay clickable in messages: the page's host, and OBP-API's list (null when it publishes none). */
	allowedLinkHosts: (pageHost: string) => Promise<{ hosts: string[]; maxMessageLength: number }>;
}

/** One room: the room (essential), its messages and participants (not), and the link and length policy. */
export function createChatRoomPage({ scope, obp, allowedLinkHosts }: ChatRoomPageConfig) {
	const paths = chatApiPaths(scope);
	async function read(chatRoomId: string, token: string, quiet: boolean) {
		const chatRoom = await obp.get(paths.room(chatRoomId), token);
		// Messages and participants are fetched in parallel but non-fatal
		const [messagesResponse, participantsResponse] = await Promise.all([
			obp.get(paths.messages(chatRoomId), token).catch((e) => {
				if (!quiet) logger.error('Error fetching messages:', e);
				return { messages: [] };
			}),
			obp.get(paths.participants(chatRoomId), token).catch((e) => {
				if (!quiet) logger.error('Error fetching participants:', e);
				return { participants: [] };
			})
		]);
		return { chatRoom, messages: messagesResponse.messages || [], participants: participantsResponse.participants || [] };
	}
	return {
		async load(event: ChatEvent) {
			const token = requireToken(event);
			const chatRoomId = event.params.chatRoomId ?? '';
			const policy = await allowedLinkHosts(event.url.hostname);
			const page = (room: Awaited<ReturnType<typeof read>>) => ({
				...room,
				currentUserId: userIdOf(event),
				allowedLinkHosts: policy.hosts,
				maxMessageLength: policy.maxMessageLength
			});
			try {
				return page(await read(chatRoomId, token, false));
			} catch (e) {
				logger.error('Error fetching chat room:', e);
				if (e instanceof OBPRequestError) {
					const code = parseInt(e.code);
					error(code >= 400 && code < 500 ? code : 500, { message: e.message });
				}
				// Diagnostic: is the OBP-API reachable at all?
				const originalError = e instanceof Error ? e.message : String(e);
				let diagnostic = '';
				try {
					await obp.get('/obp/v6.0.0/root', undefined);
					// API is reachable — retry the original request once
					logger.info('OBP-API /root is reachable, retrying chat room fetch...');
					try {
						return page(await read(chatRoomId, token, true));
					} catch (retryError) {
						diagnostic = `OBP-API is reachable (/root OK) but chat room endpoint failed on retry: ${retryError instanceof Error ? retryError.message : String(retryError)}`;
					}
				} catch {
					diagnostic = 'OBP-API is not reachable (/root failed). The API may be down or restarting.';
				}
				logger.error(diagnostic);
				error(500, { message: `${originalError}. ${diagnostic}` });
			}
		}
	};
}

/** A room's settings: edit its name and description, and refresh its joining key. */
export function createChatSettingsPage({ scope, obp }: ChatPagesConfig) {
	const paths = chatApiPaths(scope);
	return {
		async load(event: ChatEvent) {
			const token = requireToken(event);
			try {
				const chatRoom = await obp.get(paths.room(event.params.chatRoomId ?? ''), token);
				return { chatRoom, currentUserId: userIdOf(event) };
			} catch (e) {
				logger.error('Error fetching chat room:', e);
				if (e instanceof OBPRequestError) {
					const code = parseInt(e.code);
					error(code >= 400 && code < 500 ? code : 500, { message: e.message });
				}
				error(500, { message: 'Could not fetch chat room settings.' });
			}
		},
		actions: {
			update: async (event: ChatEvent) => {
				const token = tokenOf(event);
				if (!token) return { code: 'msg_no_token', message: 'No access token found in session.' };
				const formData = await event.request.formData();
				const name = formData.get('name')?.toString()?.trim();
				const description = formData.get('description')?.toString()?.trim() || '';
				if (!name) return { code: 'msg_name_required', message: 'Chat room name is required.' };
				try {
					await obp.put(paths.room(event.params.chatRoomId ?? ''), { name, description }, token);
					return { success: true, code: 'msg_updated', message: 'Chat room updated successfully.' };
				} catch (err) {
					logger.error('Error updating chat room:', err);
					if (err instanceof OBPRequestError) return { message: err.message };
					return { code: 'msg_update_failed', message: 'Failed to update chat room.' };
				}
			},
			refreshKey: async (event: ChatEvent) => {
				const token = tokenOf(event);
				if (!token) return { code: 'msg_no_token', message: 'No access token found in session.' };
				try {
					const result = await obp.put(paths.joiningKey(event.params.chatRoomId ?? ''), {}, token);
					return { success: true, code: 'msg_key_refreshed', message: 'Joining key refreshed. The old link is now invalid.', newJoiningKey: result.joining_key };
				} catch (err) {
					logger.error('Error refreshing joining key:', err);
					if (err instanceof OBPRequestError) return { message: err.message };
					return { code: 'msg_refresh_failed', message: 'Failed to refresh joining key.' };
				}
			}
		}
	};
}

/**
 * Extract the raw joining key from user input.
 * Accepts either a raw key or a full join URL containing ?joining_key=...
 */
export function extractJoiningKey(input: string): string {
	try {
		const url = new URL(input);
		const joiningKeyParam = url.searchParams.get('joining_key');
		if (joiningKeyParam) return joiningKeyParam;
	} catch {
		// Not a URL — treat as raw joining key
	}
	return input;
}

/** Joining a room with a key, from a join link (?joining_key=) or the form. */
export function createChatJoinPage({ scope, obp, basePath }: ChatPagesConfig) {
	const paths = chatApiPaths(scope);
	const join = (joiningKey: string, token: string) => {
		logger.info('Attempting to join chat room with joining_key:', joiningKey);
		return obp.post(paths.join, { joining_key: joiningKey }, token);
	};
	return {
		async load(event: ChatEvent) {
			const token = requireToken(event);
			const joiningKey = event.url.searchParams.get('joining_key');
			if (!joiningKey) return { showForm: true };
			try {
				const participant = await join(joiningKey, token);
				redirect(303, `${basePath}/${participant.chat_room_id}`);
			} catch (e) {
				if (isRedirect(e)) throw e;
				logger.error('Error joining chat room:', e);
				if (e instanceof OBPRequestError) {
					if (e.message.includes('already a participant')) {
						// Someone who already joined (e.g. from the FAQ link) should land in the room, not on this form.
						const mine = await obp.get(paths.myRooms, token).catch(() => null);
						const room = (mine?.chat_rooms ?? []).find((r: { joining_key?: string }) => r.joining_key === joiningKey);
						if (room?.chat_room_id) redirect(303, `${basePath}/${room.chat_room_id}`);
						return { showForm: true, alreadyJoined: true, errorMessage: e.message };
					}
					return { showForm: true, errorMessage: e.message };
				}
				return { showForm: true, errorCode: 'msg_join_failed_later', errorMessage: 'Could not join chat room. Please try again later.' };
			}
		},
		actions: {
			join: async (event: ChatEvent) => {
				const token = tokenOf(event);
				if (!token) return { code: 'msg_no_token', message: 'No access token found in session.' };
				const formData = await event.request.formData();
				const rawInput = formData.get('joining_key')?.toString()?.trim();
				if (!rawInput) return { code: 'msg_join_key_missing', message: 'Please enter a joining key or join link.' };
				try {
					const participant = await join(extractJoiningKey(rawInput), token);
					redirect(303, `${basePath}/${participant.chat_room_id}`);
				} catch (e) {
					if (isRedirect(e)) throw e;
					logger.error('Error joining chat room:', e);
					if (e instanceof OBPRequestError) return { message: e.message };
					return { code: 'msg_join_failed', message: 'Could not join chat room. Please try again.' };
				}
			}
		}
	};
}
