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
