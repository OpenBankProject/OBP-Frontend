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
