import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('OpeyAuthHandler');

export interface OpeyAuthHandlerConfig {
	/** Base URL of the Opey service, e.g. 'http://localhost:5000' */
	opeyBaseUrl: string;
	/** Extract the OAuth access token from the SvelteKit RequestEvent */
	getAccessToken: (event: any) => string | undefined;
}

export function createOpeyAuthHandler(config: OpeyAuthHandlerConfig): {
	POST: RequestHandler;
} {
	const { opeyBaseUrl, getAccessToken } = config;

	const POST: RequestHandler = async (event) => {
		try {
			const accessToken = getAccessToken(event);

			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			if (accessToken) {
				headers['Authorization'] = `Bearer ${accessToken}`;
			}

			logger.info(
				`Creating ${accessToken ? 'authenticated' : 'anonymous'} Opey session at ${opeyBaseUrl}/create-session`
			);

			const opeyResponse = await fetch(`${opeyBaseUrl}/create-session`, {
				method: 'POST',
				headers
			});

			if (!opeyResponse.ok) {
				const errorText = await opeyResponse.text();
				logger.error(`Opey session creation failed: ${errorText}`);
				return json({ error: errorText }, { status: opeyResponse.status });
			}

			logger.info(
				`Successfully created ${accessToken ? 'authenticated' : 'anonymous'} Opey session`
			);

			const setCookie = opeyResponse.headers.get('set-cookie');
			return json(
				{ success: true, authenticated: !!accessToken },
				setCookie ? { headers: { 'Set-Cookie': setCookie } } : {}
			);
		} catch (error: any) {
			logger.error('Opey auth error:', error);
			return json({ error: error.message || 'Internal Server Error' }, { status: 500 });
		}
	};

	return { POST };
}
