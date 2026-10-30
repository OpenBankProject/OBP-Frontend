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
const logger = createLogger('SessionController');
import type { SessionService } from '../services/SessionService.js';
import type { SessionState } from '../state/SessionState.js';
import { isRetryableStatus } from '../errors.js';

export class SessionController {
	constructor(
		private service: SessionService,
		public sessionState: SessionState
	) {}

	async init(): Promise<void> {
		try {
			this.sessionState.setStatus('loading');
			const result = await this.service.createSession();
			this.sessionState.setAuth(result.authenticated);
			this.sessionState.setStatus('ready');
		} catch (error: any) {
			logger.error('Session init error:', error);
			this.sessionState.setStatus('error', error.message, error.status);
		}
	}

	/**
	 * Start the session, retrying with exponential backoff.
	 *
	 * A logged-out visitor has nothing to authenticate with, so the auth route is not called at all
	 * (the chat asks them to log in). A refusal that will come out the same next time (a 4xx such as
	 * 401) is reported at once with its real cause instead of being retried.
	 */
	async initWithRetry(options: {
		userAuthenticated: boolean;
		maxRetries?: number;
		baseDelay?: number;
		sleep?: (ms: number) => Promise<void>;
	}): Promise<void> {
		const { userAuthenticated, maxRetries = 3, baseDelay = 1000 } = options;
		const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

		if (!userAuthenticated) {
			this.sessionState.setAuth(false);
			this.sessionState.setStatus('ready');
			return;
		}

		let lastError: string | undefined;
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			await this.init();
			const snapshot = this.sessionState.current;
			if (snapshot.status === 'ready') {
				logger.debug(`Opey session initialized successfully on attempt ${attempt}`);
				return;
			}
			lastError = snapshot.error;
			if (!isRetryableStatus(snapshot.errorStatus)) {
				// Leave the refusal as it is: its message names the cause.
				logger.warn(`Opey session refused (HTTP ${snapshot.errorStatus}): ${lastError}`);
				return;
			}
			if (attempt < maxRetries) {
				await sleep(baseDelay * Math.pow(2, attempt - 1));
			}
		}

		const finalMessage = lastError
			? `Failed to initialize after ${maxRetries} attempts: ${lastError}`
			: `Failed to initialize after ${maxRetries} attempts`;
		logger.error(finalMessage);
		this.sessionState.setStatus('error', finalMessage);
	}

	async destroy(): Promise<void> {
		this.sessionState.setStatus('loading');
		await this.service.deleteSession();
		this.sessionState.setAuth(false);
		this.sessionState.setStatus('ready');
	}
}
