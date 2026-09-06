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
import { redirect, error } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { createLogger } from '@obp/shared/utils';
import { getOrCreateFaqChat } from '$lib/server/faq/faqChat';

const logger = createLogger('FaqChatRoute');

/**
 * POST /faq/chat/ID: join the question's group chat, creating it on first use.
 * A form post from the FAQ card; signed-out visitors are sent to log in and come back here.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	const token = locals.session?.data?.oauth?.access_token;
	if (!token) redirect(303, `/login?redirect=${encodeURIComponent('/faq')}`);

	let outcome;
	try {
		outcome = await getOrCreateFaqChat(params.id, token, String(publicEnv.PUBLIC_PORTAL_URL ?? '').replace(/\/$/, ''));
	} catch (e) {
		logger.error(`Could not start a chat for FAQ item ${params.id}:`, e);
		error(502, { message: `Could not create the chat room: ${e instanceof Error ? e.message : String(e)}` });
	}
	if (!outcome) error(404, { message: 'No such FAQ question.' });

	// The creator is already a participant; anyone else joins with the key (the join page
	// sends an existing participant straight to the room).
	if (outcome.created) redirect(303, `/user/chat/${outcome.chat_room_id}`);
	if (outcome.joining_key) redirect(303, `/user/chat/join?joining_key=${encodeURIComponent(outcome.joining_key)}`);
	redirect(303, `/user/chat/${outcome.chat_room_id}`);
};
