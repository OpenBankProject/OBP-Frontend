/**
 * Writes the chat into a personal dynamic entity as the logged-in user, through the app's
 * OBP proxy (the user's own session, never Opey's consent). One row per thread: created on
 * the first completed message, PATCHed after each further completed message.
 *
 * Failures never interrupt the chat: they are reported through `onStatus` and retried on
 * the next completed message. A 404 from OBP means the entity is not defined on this
 * instance; that is reported once as 'unavailable' and recording stops for the session.
 */
import { createLogger } from '../../utils/logger';
import type { BaseMessage } from '../types';
import { buildConversationRow, completedMessages, type ConversationRow } from '../utils/conversationRecord';

export type ConversationRecordStatus = 'idle' | 'saved' | 'unavailable' | 'error';

const logger = createLogger('ConversationRecorder');

export interface ConversationRecorderOptions {
	/** Personal dynamic entity name, e.g. an app's own conversation entity. */
	entityName: string;
	/** Browser-reachable OBP proxy prefix; the entity route is appended. Default '/proxy/obp'. */
	proxyBase?: string;
	fetchImpl?: typeof fetch;
	onStatus?: (status: ConversationRecordStatus, detail?: string) => void;
}

export class ConversationRecorder {
	private readonly entityName: string;
	private readonly url: string;
	private readonly fetchImpl: typeof fetch;
	private readonly onStatus?: ConversationRecorderOptions['onStatus'];
	private rowId: string | null = null;
	private startedAt: string | undefined;
	private savedCount = 0;
	private savedConsentKey = '';
	private stopped = false;
	private queue: Promise<void> = Promise.resolve();

	constructor(options: ConversationRecorderOptions) {
		this.entityName = options.entityName;
		this.url = `${(options.proxyBase ?? '/proxy/obp').replace(/\/$/, '')}/dynamic-entity/my/${encodeURIComponent(options.entityName)}`;
		this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
		this.onStatus = options.onStatus;
	}

	/** Field OBP uses for the record id: `<entity>_id`. */
	get idField(): string {
		return `${this.entityName}_id`;
	}

	/**
	 * Called with every chat snapshot. Writes only when the set of completed messages grew
	 * (or the consents used changed), and serialises writes so a slow PATCH cannot race a
	 * later one.
	 */
	record(threadId: string, messages: BaseMessage[], consentReferenceIds: string[] = []): Promise<void> {
		if (this.stopped || !threadId) return Promise.resolve();
		const completed = completedMessages(messages);
		const consentKey = Array.from(new Set(consentReferenceIds.filter(Boolean))).sort().join(',');
		if (completed.length === 0) return Promise.resolve();
		if (completed.length === this.savedCount && consentKey === this.savedConsentKey) return Promise.resolve();
		const row = buildConversationRow(threadId, completed, consentReferenceIds, this.startedAt);
		this.queue = this.queue.then(() => this.write(row, completed.length, consentKey)).catch(() => undefined);
		return this.queue;
	}

	private async write(row: ConversationRow, count: number, consentKey: string): Promise<void> {
		if (this.stopped) return;
		try {
			const response = this.rowId
				? await this.fetchImpl(`${this.url}/${encodeURIComponent(this.rowId)}`, {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
						body: JSON.stringify(row)
					})
				: await this.fetchImpl(this.url, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
						body: JSON.stringify(row)
					});
			if (response.status === 404 && !this.rowId) {
				this.stopped = true;
				logger.info(`Conversation entity '${this.entityName}' is not defined on this instance; recording off.`);
				this.onStatus?.('unavailable', `The dynamic entity ${this.entityName} does not exist on this instance.`);
				return;
			}
			if (!response.ok) {
				let detail = `HTTP ${response.status}`;
				try {
					const body = await response.json();
					if (body?.message) detail = String(body.message);
				} catch {
					/* non-JSON body */
				}
				logger.warn(`Conversation record write failed: ${detail}`);
				this.onStatus?.('error', detail);
				return;
			}
			if (!this.rowId) {
				const body = await response.json().catch(() => ({}));
				const record = body?.[this.entityName] ?? body;
				const id = record?.[this.idField];
				if (typeof id !== 'string' || !id) {
					logger.warn('Conversation record created but no id came back; will create again next time.');
					this.onStatus?.('error', 'no record id returned');
					return;
				}
				this.rowId = id;
				this.startedAt = row.started_at;
			}
			this.savedCount = count;
			this.savedConsentKey = consentKey;
			this.onStatus?.('saved');
		} catch (err) {
			logger.warn(`Conversation record write failed: ${err}`);
			this.onStatus?.('error', err instanceof Error ? err.message : String(err));
		}
	}
}
