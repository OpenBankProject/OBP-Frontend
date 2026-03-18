import { createLogger } from '../../utils/logger.js';
const logger = createLogger('OpeySessionService');
import type { SessionService } from './SessionService.js';

/**
 * Manages Opey sessions by calling the host app's auth proxy endpoint.
 *
 * The host app's /api/opey/auth route handles:
 * - Reading the OAuth access token from the server-side session
 * - Forwarding it as a Bearer token to Opey's /create-session
 * - Returning whether the session is authenticated or anonymous
 *
 * This service does NOT talk to Opey directly — it goes through
 * the host app's server route, which is the only place that has
 * access to the OAuth token.
 */
export class OpeySessionService implements SessionService {
	constructor(private authEndpoint: string = '/api/opey/auth') {}

	async createSession(): Promise<{ authenticated: boolean }> {
		logger.info('Creating Opey session via auth endpoint');

		const response = await fetch(this.authEndpoint, {
			method: 'POST',
			credentials: 'include'
		});

		const data = await response.json();

		if (!response.ok) {
			throw new Error(data.error || 'Failed to create Opey session');
		}

		logger.info(`Opey session created - authenticated: ${data.authenticated}`);
		return { authenticated: data.authenticated };
	}

	async deleteSession(): Promise<void> {
		const res = await fetch(this.authEndpoint.replace('/auth', '/session'), {
			method: 'DELETE',
			credentials: 'include'
		});
		if (!res.ok) {
			throw new Error(`Session deletion failed: ${res.statusText}`);
		}
	}

	async getStatus(): Promise<{ status: string }> {
		const res = await fetch(this.authEndpoint.replace('/auth', '/status'), {
			method: 'GET',
			credentials: 'include'
		});
		if (!res.ok) {
			throw new Error(`Failed to get session status: ${res.statusText}`);
		}
		return await res.json();
	}
}
