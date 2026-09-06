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
import { createLogger } from '../../utils/logger.js';
const logger = createLogger('OpeySessionService');
import type { SessionService } from './SessionService.js';

/**
 * Manages Opey sessions by calling the host app's auth proxy endpoint.
 *
 * The host app's /backend/opey/auth route handles:
 * - Reading the OAuth access token from the server-side session
 * - Forwarding it as a Bearer token to Opey's /create-session
 * - Returning whether the session is authenticated or anonymous
 *
 * This service does NOT talk to Opey directly — it goes through
 * the host app's server route, which is the only place that has
 * access to the OAuth token.
 */
export class OpeySessionService implements SessionService {
	constructor(private authEndpoint: string = '/backend/opey/auth') {}

	async createSession(): Promise<{ authenticated: boolean }> {
		logger.info('Creating Opey session via auth endpoint');

		const response = await fetch(this.authEndpoint, {
			method: 'POST',
			credentials: 'include'
		});

		const data = await response.json();

		if (!response.ok) {
			throw new Error(data.message ?? `HTTP ${response.status}`);
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
