import { createLogger } from '$lib/utils/logger';
const logger = createLogger('Logout');
import type { RequestEvent } from '@sveltejs/kit';

export async function GET(event: RequestEvent): Promise<Response> {
	const { session } = event.locals;

	logger.info('User logging out:', session.data.user?.username);

	await session.destroy();

	return new Response(null, {
		status: 302,
		headers: {
			Location: '/'
		}
	});
}
