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
 * Turning resource docs into the trimmed index, and identifying one endpoint.
 *
 * An endpoint's identity here is (verb, path). Measured against a full OBP catalogue
 * that is unique for every endpoint — 1143 of 1143 docs, no collisions — whereas the
 * function name is not (17 duplicates in the v6 catalogue, e.g. deleteEntitlement
 * exists at both v2.0.0 and v6.0.0). That is what lets an Explorer URL mirror the
 * call a developer would actually make.
 */
import type { ResourceDoc, ResourceDocIndexEntry } from './types.js';

/**
 * The path to show and link by. `request_url` is relative for dynamic entities, so
 * `specified_url` is the one to trust; fall back only when it is absent.
 */
export function endpointPath(doc: ResourceDoc): string {
	const path = doc.specified_url || doc.request_url || '';
	return path.startsWith('/') ? path : `/${path}`;
}

export function toIndexEntry(doc: ResourceDoc): ResourceDocIndexEntry {
	return {
		operationId: doc.operation_id,
		verb: (doc.request_verb || 'GET').toUpperCase(),
		path: endpointPath(doc),
		summary: doc.summary || '',
		tags: doc.tags ?? []
	};
}

export function buildIndex(docs: ResourceDoc[]): ResourceDocIndexEntry[] {
	return docs.map(toIndexEntry);
}

/** Stable key for an endpoint within a catalogue. */
export function endpointKey(verb: string, path: string): string {
	const p = path.startsWith('/') ? path : `/${path}`;
	return `${verb.toUpperCase()} ${p.replace(/\/+$/, '') || '/'}`;
}

export function docKey(doc: ResourceDoc): string {
	return endpointKey(doc.request_verb, endpointPath(doc));
}

/** Find one doc in a catalogue by the verb and path an Explorer URL carries. */
export function findDocByEndpoint(
	docs: ResourceDoc[],
	verb: string,
	path: string
): ResourceDoc | undefined {
	const wanted = endpointKey(verb, path);
	return docs.find((d) => docKey(d) === wanted);
}

export function findDocByOperationId(
	docs: ResourceDoc[],
	operationId: string
): ResourceDoc | undefined {
	return docs.find((d) => d.operation_id === operationId);
}

/** "OBPv6.0.0-getBanks" -> "OBPv6.0.0". The implementation version, not the catalogue's. */
export function operationIdVersion(operationId: string): string | undefined {
	return operationId.match(/^([A-Za-z-]*v[0-9.]+)-/)?.[1];
}

/** "OBPv6.0.0-getBanks" -> "getBanks". */
export function operationIdFunction(operationId: string): string {
	const dash = operationId.indexOf('-');
	return dash === -1 ? operationId : operationId.slice(dash + 1);
}

/** Every tag in a catalogue with how many endpoints carry it, most used first. */
export function collectTags(entries: ResourceDocIndexEntry[]): Array<{ tag: string; count: number }> {
	const counts = new Map<string, number>();
	for (const e of entries) {
		for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
	}
	return [...counts.entries()]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
