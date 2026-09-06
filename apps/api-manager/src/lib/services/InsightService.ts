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
import { createLogger } from '@obp/shared/utils';

const logger = createLogger('InsightService');

interface NotebookEntry {
	timestamp: string;
	note: string;
	opey_notebook_id?: string;
}

/**
 * Service for the Opey Insight Bar.
 *
 * Responsibilities:
 * 1. Write navigation events to the opey_notebook personal dynamic entity
 * 2. Fetch the last N notebook entries
 * 3. Ask Opey for a short contextual insight via the /invoke endpoint
 */
export class InsightService {
	/**
	 * Write a navigation note to the opey_notebook.
	 */
	async writeNote(note: string): Promise<void> {
		try {
			const res = await fetch('/proxy/obp/dynamic-entity/my/opey_notebook', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					timestamp: new Date().toISOString(),
					note
				})
			});

			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				logger.warn('Failed to write notebook entry:', err);
			}
		} catch (err) {
			logger.warn('Error writing notebook entry:', err);
		}
	}

	/**
	 * Fetch recent notebook entries (returns all, caller can slice).
	 */
	async getRecentNotes(limit = 10): Promise<NotebookEntry[]> {
		try {
			const res = await fetch('/proxy/obp/dynamic-entity/my/opey_notebook', {
				credentials: 'include'
			});

			if (!res.ok) {
				logger.warn('Failed to fetch notebook entries');
				return [];
			}

			const data = await res.json();
			// OBP returns { opey_notebook_list: [...] } for dynamic entities
			const entries: NotebookEntry[] = data.opey_notebook_list || data.opey_notebooks || [];

			// Sort by timestamp descending and take the most recent
			return entries
				.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
				.slice(0, limit);
		} catch (err) {
			logger.warn('Error fetching notebook entries:', err);
			return [];
		}
	}

	/**
	 * Ask Opey for a short contextual insight.
	 *
	 * Sends the recent notebook entries + current page context to Opey's
	 * /invoke endpoint and returns the text response.
	 *
	 * Returns null if the request fails (caller should show fallback).
	 */
	async getInsight(pageContext: string, recentNotes: NotebookEntry[]): Promise<string | null> {
		const notesText = recentNotes.length > 0
			? recentNotes.map(n => `[${n.timestamp}] ${n.note}`).join('\n')
			: '(no recent activity)';

		const message = [
			'You are the Opey Insight Bar. Based on the recent activity below, make a VERY SHORT observation (1 sentence, max 15 words) about how this data might be related.',
			'If you have nothing useful to say, respond with an empty string.',
			'Do NOT use markdown. Do NOT ask questions.',
			'',
			`Current page: ${pageContext}`,
			'',
			'Recent activity:',
			notesText
		].join('\n');

		try {
			const res = await fetch('/backend/opey/invoke', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					message,
					stream_tokens: false
				})
			});

			if (!res.ok) {
				logger.warn(`Insight invoke failed: ${res.status}`);
				return null;
			}

			const data = await res.json();
			// The /invoke endpoint returns a ChatMessage with content field
			const content = typeof data.content === 'string' ? data.content : data.content?.text || '';
			return content.trim() || null;
		} catch (err) {
			logger.warn('Error getting insight from Opey:', err);
			return null;
		}
	}
}

/** Singleton instance */
export const insightService = new InsightService();
