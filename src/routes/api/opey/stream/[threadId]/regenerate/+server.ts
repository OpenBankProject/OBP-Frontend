import { createLogger } from '$lib/utils/logger';
const logger = createLogger('OpeyRegenerateProxy');
import type { RequestEvent } from './$types';
import { env } from '$env/dynamic/private';

export async function POST(event: RequestEvent) {
	const opeyBaseUrl = env.OPEY_BASE_URL || 'http://localhost:5000';
	const { threadId } = event.params;
	const messageId = event.url.searchParams.get('message_id');
	const cookie = event.request.headers.get('cookie') || '';

	logger.debug(`Proxying regenerate request for thread ${threadId}, message ${messageId}`);

	const url = messageId
		? `${opeyBaseUrl}/stream/${threadId}/regenerate?message_id=${messageId}`
		: `${opeyBaseUrl}/stream/${threadId}/regenerate`;

	const opeyResponse = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Cookie': cookie
		}
	});

	const responseHeaders = new Headers({
		'Content-Type': opeyResponse.headers.get('Content-Type') || 'text/event-stream',
		'Cache-Control': 'no-cache',
	});

	const threadIdHeader = opeyResponse.headers.get('X-Thread-ID');
	if (threadIdHeader) responseHeaders.set('X-Thread-ID', threadIdHeader);

	return new Response(opeyResponse.body, {
		status: opeyResponse.status,
		headers: responseHeaders
	});
}
