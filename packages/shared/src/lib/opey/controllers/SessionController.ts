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
			this.sessionState.setStatus('error', error.message);
		}
	}

	async destroy(): Promise<void> {
		this.sessionState.setStatus('loading');
		await this.service.deleteSession();
		this.sessionState.setAuth(false);
		this.sessionState.setStatus('ready');
	}
}
