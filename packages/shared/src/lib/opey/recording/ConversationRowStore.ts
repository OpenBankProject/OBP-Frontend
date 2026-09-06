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
/**
 * One row per Opey thread in a personal dynamic entity, written as the logged-in user.
 *
 * `append` merges the messages that completed in one proxied turn into the thread's row:
 * it finds the row (a per-process cache in front of a list-and-match on thread_id, so a
 * second app instance still finds rows the first one wrote), merges by message id,
 * optionally truncates for a regenerate, and creates or patches the row.
 *
 * Failures never reach the chat: every outcome comes back as a value. A 404 means the
 * entity is not defined on this OBP instance; that is remembered for a while so a missing
 * entity does not cost a failing request per message.
 */
import { createLogger } from '../../utils/logger';
import {
	buildConversationRow,
	mergeMessages,
	parseMessagesJson,
	truncateAfter,
	type RecordedMessage
} from '../utils/conversationRecord';

const logger = createLogger('ConversationRowStore');

/** The subset of an app's OBP request helper the store needs. Calls run as the user (their token). */
export interface ConversationObpRequests {
	get(path: string, accessToken?: string): Promise<any>;
	post(path: string, body: any, accessToken?: string): Promise<any>;
	patch(path: string, body: any, accessToken?: string): Promise<any>;
}

export interface AppendConversationInput {
	accessToken: string;
	threadId: string;
	/** Messages that completed in this turn. */
	messages: RecordedMessage[];
	/** consent_reference_ids used in this turn; unioned with the ones already stored. */
	consentReferenceIds?: string[];
	/** Regenerate: stored messages after this id are dropped before the new ones are merged. */
	truncateAfterMessageId?: string;
	/** Path of the page the chat is embedded in; the latest known value is kept on the row. */
	page?: string;
}

export type ConversationRecordOutcome =
	| { status: 'saved'; recordId: string; messageCount: number }
	| { status: 'skipped'; reason: string }
	| { status: 'unavailable'; detail: string }
	| { status: 'error'; detail: string };

export interface ConversationRowStoreOptions {
	now?: () => Date;
	/** How long a 404 (entity not defined) is remembered before trying again. Default 5 minutes. */
	unavailableRetryMs?: number;
	/** Threads kept in the in-memory cache. Default 1000. */
	cacheLimit?: number;
}

interface CachedRow {
	rowId: string;
	/** Absent when the stored row has no usable started_at; the row builder then uses the first message. */
	startedAt?: string;
	messages: RecordedMessage[];
	consentReferenceIds: string[];
	page: string;
}

function is404(err: unknown): boolean {
	const e = err as any;
	const code = e?.code ?? e?.statusCode ?? e?.status;
	return code === 404 || code === '404';
}

function errorDetail(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export class ConversationRowStore {
	readonly path: string;
	readonly idField: string;
	readonly listField: string;
	private readonly rows = new Map<string, CachedRow>();
	private readonly queues = new Map<string, Promise<unknown>>();
	private unavailableUntil = 0;
	private unavailableDetail = '';
	private readonly now: () => Date;
	private readonly unavailableRetryMs: number;
	private readonly cacheLimit: number;

	constructor(
		readonly entityName: string,
		private readonly obp: ConversationObpRequests,
		options: ConversationRowStoreOptions = {}
	) {
		this.path = `/obp/dynamic-entity/my/${encodeURIComponent(entityName)}`;
		this.idField = `${entityName}_id`;
		this.listField = `${entityName}_list`;
		this.now = options.now ?? (() => new Date());
		this.unavailableRetryMs = options.unavailableRetryMs ?? 5 * 60 * 1000;
		this.cacheLimit = options.cacheLimit ?? 1000;
	}

	/**
	 * Merge one turn into the thread's row. Writes for the same thread are serialised, so a
	 * consent resume that follows its first request closely cannot race it.
	 */
	append(input: AppendConversationInput): Promise<ConversationRecordOutcome> {
		if (!input.threadId) return Promise.resolve({ status: 'skipped', reason: 'no thread id' });
		const previous = this.queues.get(input.threadId) ?? Promise.resolve();
		const task = previous.then(
			() => this.appendNow(input),
			() => this.appendNow(input)
		);
		this.queues.set(input.threadId, task);
		void task.finally(() => {
			if (this.queues.get(input.threadId) === task) this.queues.delete(input.threadId);
		});
		return task;
	}

	private async appendNow(input: AppendConversationInput): Promise<ConversationRecordOutcome> {
		const nowMs = this.now().getTime();
		if (nowMs < this.unavailableUntil) return { status: 'unavailable', detail: this.unavailableDetail };

		try {
			const existing = this.rows.get(input.threadId) ?? (await this.find(input.threadId, input.accessToken));
			const kept = truncateAfter(existing?.messages ?? [], input.truncateAfterMessageId);
			const messages = mergeMessages(kept, input.messages);
			if (messages.length === 0) return { status: 'skipped', reason: 'no completed messages' };

			const consentReferenceIds = Array.from(
				new Set([...(existing?.consentReferenceIds ?? []), ...(input.consentReferenceIds ?? [])].filter(Boolean))
			).sort();

			const page = input.page || existing?.page || '';
			if (
				existing &&
				sameTranscript(existing.messages, messages) &&
				sameList(existing.consentReferenceIds, consentReferenceIds) &&
				existing.page === page
			) {
				return { status: 'skipped', reason: 'unchanged' };
			}

			const row = buildConversationRow(input.threadId, messages, consentReferenceIds, existing?.startedAt, this.now(), page);
			let rowId: string;
			if (existing) {
				await this.obp.patch(`${this.path}/${encodeURIComponent(existing.rowId)}`, row, input.accessToken);
				rowId = existing.rowId;
			} else {
				const created = await this.obp.post(this.path, row, input.accessToken);
				const record = created?.[this.entityName] ?? created;
				const id = record?.[this.idField];
				if (typeof id !== 'string' || !id) {
					logger.warn(`Row created in '${this.entityName}' but no ${this.idField} came back; it will be found by thread_id next time.`);
					return { status: 'error', detail: 'no record id returned' };
				}
				rowId = id;
			}
			this.remember(input.threadId, { rowId, startedAt: row.started_at, messages, consentReferenceIds, page });
			return { status: 'saved', recordId: rowId, messageCount: messages.length };
		} catch (err) {
			if (is404(err)) {
				this.unavailableUntil = nowMs + this.unavailableRetryMs;
				this.unavailableDetail = `The dynamic entity ${this.entityName} does not exist on this instance.`;
				logger.info(`'${this.entityName}' is not defined on this OBP instance; conversation recording is off for a while.`);
				return { status: 'unavailable', detail: this.unavailableDetail };
			}
			const detail = errorDetail(err);
			logger.warn(`Conversation record write failed for thread ${input.threadId}: ${detail}`);
			return { status: 'error', detail };
		}
	}

	/** The user's row for this thread, if one exists. Personal entities list only the caller's rows. */
	private async find(threadId: string, accessToken: string): Promise<CachedRow | null> {
		const data = await this.obp.get(this.path, accessToken);
		const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.[this.listField]) ? data[this.listField] : [];
		const found = list.find((r) => r && r.thread_id === threadId);
		const rowId = found?.[this.idField];
		if (!found || typeof rowId !== 'string' || !rowId) return null;
		const cached: CachedRow = {
			rowId,
			startedAt: typeof found.started_at === 'string' && found.started_at ? found.started_at : undefined,
			messages: parseMessagesJson(found.messages_json),
			consentReferenceIds: String(found.consent_reference_ids ?? '')
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
				.sort(),
			page: typeof found.page === 'string' ? found.page : ''
		};
		this.remember(threadId, cached);
		return cached;
	}

	private remember(threadId: string, row: CachedRow): void {
		this.rows.delete(threadId);
		this.rows.set(threadId, row);
		while (this.rows.size > this.cacheLimit) {
			const oldest = this.rows.keys().next().value;
			if (oldest === undefined) break;
			this.rows.delete(oldest);
		}
	}
}

function sameTranscript(a: RecordedMessage[], b: RecordedMessage[]): boolean {
	return a.length === b.length && a.every((m, i) => m.id === b[i].id && m.text === b[i].text);
}

function sameList(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((v, i) => v === b[i]);
}
