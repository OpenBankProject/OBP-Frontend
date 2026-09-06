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
const logger = createLogger('ChatJoinServer');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { redirect, error, isRedirect } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';

/**
 * Extract the raw joining key from user input.
 * Accepts either a raw key or a full join URL containing ?joining_key=...
 */
function extractJoiningKey(input: string): string {
	try {
		const url = new URL(input);
		const joiningKeyParam = url.searchParams.get('joining_key');
		if (joiningKeyParam) return joiningKeyParam;
	} catch {
		// Not a URL — treat as raw joining key
	}
	return input;
}

async function joinWithJoiningKey(joiningKey: string, token: string) {
	logger.info('Attempting to join chat room with joining_key:', joiningKey);
	return await obp_requests.post(
		'/obp/v6.0.0/chat-room-participants',
		{ joining_key: joiningKey },
		token
	);
}

export async function load(event: RequestEvent) {
	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		error(401, { message: 'Unauthorized: No access token found in session.' });
	}

	const joiningKey = event.url.searchParams.get('joining_key');
	if (!joiningKey) {
		return { showForm: true };
	}

	try {
		const participant = await joinWithJoiningKey(joiningKey, token);
		redirect(303, `/user/chat/${participant.chat_room_id}`);
	} catch (e) {
		if (isRedirect(e)) throw e;

		logger.error('Error joining chat room:', e);
		if (e instanceof OBPRequestError) {
			if (e.message.includes('already a participant')) {
				// Someone who already joined (e.g. from the FAQ link) should land in the room, not on this form.
				const mine = await obp_requests.get('/obp/v6.0.0/users/current/chat-rooms', token).catch(() => null);
				const room = (mine?.chat_rooms ?? []).find((r: { joining_key?: string }) => r.joining_key === joiningKey);
				if (room?.chat_room_id) redirect(303, `/user/chat/${room.chat_room_id}`);
				return { showForm: true, alreadyJoined: true, errorMessage: e.message };
			}
			return { showForm: true, errorMessage: e.message };
		}
		return { showForm: true, errorMessage: 'Could not join chat room. Please try again later.' };
	}
}

export const actions = {
	join: async ({ request, locals }) => {
		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { message: 'No access token found in session.' };
		}

		const formData = await request.formData();
		const rawInput = formData.get('joining_key')?.toString()?.trim();

		if (!rawInput) {
			return { message: 'Please enter a joining key or join link.' };
		}

		const joiningKey = extractJoiningKey(rawInput);

		try {
			const participant = await joinWithJoiningKey(joiningKey, token);
			redirect(303, `/user/chat/${participant.chat_room_id}`);
		} catch (e) {
			if (isRedirect(e)) throw e;

			logger.error('Error joining chat room:', e);
			let errorMessage = 'Could not join chat room. Please try again.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { message: errorMessage };
		}
	}
} satisfies Actions;
