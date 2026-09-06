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
import { createLogger } from '@obp/shared/utils';
const logger = createLogger('ChatRoomSettingsServer');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';

export async function load(event: RequestEvent) {
	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		error(401, { message: 'Unauthorized: No access token found in session.' });
	}

	const chatRoomId = event.params.chatRoomId;

	try {
		const chatRoom = await obp_requests.get(`/obp/v6.0.0/chat-rooms/${chatRoomId}`, token);
		return {
			chatRoom,
			currentUserId: event.locals.session.data.user?.user_id || ''
		};
	} catch (e) {
		logger.error('Error fetching chat room:', e);
		if (e instanceof OBPRequestError) {
			const code = parseInt(e.code);
			error(code >= 400 && code < 500 ? code : 500, { message: e.message });
		}
		error(500, { message: 'Could not fetch chat room settings.' });
	}
}

export const actions = {
	update: async ({ request, locals, params }) => {
		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { message: 'No access token found in session.' };
		}

		const formData = await request.formData();
		const name = formData.get('name')?.toString()?.trim();
		const description = formData.get('description')?.toString()?.trim() || '';

		if (!name) {
			return { message: 'Chat room name is required.' };
		}

		try {
			await obp_requests.put(
				`/obp/v6.0.0/chat-rooms/${params.chatRoomId}`,
				{ name, description },
				token
			);
			return { success: true, message: 'Chat room updated successfully.' };
		} catch (err) {
			logger.error('Error updating chat room:', err);
			let errorMessage = 'Failed to update chat room.';
			if (err instanceof OBPRequestError) {
				errorMessage = err.message;
			}
			return { message: errorMessage };
		}
	},

	refreshKey: async ({ locals, params }) => {
		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { message: 'No access token found in session.' };
		}

		try {
			const result = await obp_requests.put(
				`/obp/v6.0.0/chat-rooms/${params.chatRoomId}/joining-key`,
				{},
				token
			);
			return {
				success: true,
				message: 'Joining key refreshed. The old link is now invalid.',
				newJoiningKey: result.joining_key
			};
		} catch (err) {
			logger.error('Error refreshing joining key:', err);
			let errorMessage = 'Failed to refresh joining key.';
			if (err instanceof OBPRequestError) {
				errorMessage = err.message;
			}
			return { message: errorMessage };
		}
	}
} satisfies Actions;
