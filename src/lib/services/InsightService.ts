import { createLogger } from '$lib/utils/logger';

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
			const res = await fetch('/api/dynamic-entities/personal/opey_notebook/my', {
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
			const res = await fetch('/api/dynamic-entities/personal/opey_notebook/my', {
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
			'You are the Opey Insight Bar. Your job is to make a VERY SHORT observation (1 sentence, max 15 words) based on what the user has been doing and where they are now.',
			'If you have nothing useful to say, respond with an empty string.',
			'Do NOT use markdown. Do NOT ask questions. Just make a brief, helpful observation or tip.',
			'',
			`Current page: ${pageContext}`,
			'',
			'Recent activity:',
			notesText
		].join('\n');

		try {
			const res = await fetch('/api/opey/invoke', {
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
