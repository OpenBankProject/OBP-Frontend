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
 * Ranked search over the resource doc index. Pure and synchronous: the index is small
 * enough (~33 KB gzipped for a full catalogue) to live in the browser, so typing
 * filters locally with no round trip.
 */
import type { ResourceDocIndexEntry } from './types.js';

export interface SearchOptions {
	/** Only entries carrying this tag. */
	tag?: string;
	limit?: number;
}

/**
 * Score one entry against a lowercased query. Higher is better, 0 means no match.
 * The ordering intent: an exact operation id beats a path match, which beats prose.
 */
function scoreEntry(entry: ResourceDocIndexEntry, q: string): number {
	const operationId = entry.operationId.toLowerCase();
	const path = entry.path.toLowerCase();
	const summary = entry.summary.toLowerCase();

	if (operationId === q) return 100;
	if (operationId.endsWith(`-${q}`)) return 90; // the function name exactly
	if (path === q) return 85;
	if (operationId.includes(q)) return 70;
	if (path.startsWith(q)) return 60;
	if (path.includes(q)) return 50;
	if (summary.startsWith(q)) return 40;
	if (summary.includes(q)) return 30;
	if (entry.tags.some((t) => t.toLowerCase().includes(q))) return 20;
	return 0;
}

/**
 * Entries matching every whitespace-separated term, ranked. An empty query returns
 * everything (tag filter still applies) in catalogue order.
 */
export function searchIndex(
	entries: ResourceDocIndexEntry[],
	query: string,
	options: SearchOptions = {}
): ResourceDocIndexEntry[] {
	const { tag, limit } = options;
	const pool = tag ? entries.filter((e) => e.tags.includes(tag)) : entries;

	const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (terms.length === 0) return limit ? pool.slice(0, limit) : pool;

	const scored: Array<{ entry: ResourceDocIndexEntry; score: number }> = [];
	for (const entry of pool) {
		let total = 0;
		for (const term of terms) {
			const score = scoreEntry(entry, term);
			if (score === 0) {
				total = 0;
				break; // every term must match
			}
			total += score;
		}
		if (total > 0) scored.push({ entry, score: total });
	}

	scored.sort((a, b) => b.score - a.score || a.entry.path.localeCompare(b.entry.path));
	const ranked = scored.map((s) => s.entry);
	return limit ? ranked.slice(0, limit) : ranked;
}
