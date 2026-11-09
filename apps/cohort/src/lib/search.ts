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
 * Full-text search over the records a User may read: each record becomes a searchable item, matched on every word of
 * the query (all words must match), scored by where they match, and sorted by relevance or date. Text is normalised so
 * Arabic matches whatever form of alef, ya or ta marbuta was typed, with or without diacritics.
 */

export const SEARCH_KINDS = ['call', 'programme', 'announcement', 'application', 'startup'] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export interface SearchItem {
	kind: SearchKind;
	id: string;
	title: string;
	/** Everything else searchable about it. */
	text: string;
	href: string;
	/** For sorting by date (ISO 8601 or YYYY-MM-DD); empty when it has none. */
	date: string;
	/** A startup's or application's stage or status, for filtering. */
	stage?: string;
}

export interface SearchHit extends SearchItem {
	score: number;
}

/** Lower case, Arabic letters in one form and without diacritics or tatweel, and runs of space as one. */
export function normalise(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ًͯ-ٰٟـ]/g, '')
		.replace(/[آأإٱ]/g, 'ا')
		.replace(/ى/g, 'ي')
		.replace(/ة/g, 'ه')
		.replace(/\s+/g, ' ')
		.trim();
}

export function search(
	items: SearchItem[],
	query: string,
	options: { kind?: string; stage?: string; sort?: 'relevance' | 'date' } = {}
): SearchHit[] {
	const words = normalise(query).split(' ').filter(Boolean);
	if (words.length === 0) return [];
	const hits: SearchHit[] = [];
	for (const item of items) {
		if (options.kind && item.kind !== options.kind) continue;
		if (options.stage && item.stage !== options.stage) continue;
		const title = normalise(item.title);
		const text = normalise(item.text);
		if (!words.every((w) => title.includes(w) || text.includes(w))) continue;
		let score = 0;
		for (const w of words) {
			if (title.includes(w)) score += title.startsWith(w) || title.includes(` ${w}`) ? 3 : 2;
			if (text.includes(w)) score += 1;
		}
		if (title === words.join(' ')) score += 5;
		hits.push({ ...item, score });
	}
	return hits.sort((a, b) =>
		options.sort === 'date' ? b.date.localeCompare(a.date) || b.score - a.score : b.score - a.score || b.date.localeCompare(a.date)
	);
}
