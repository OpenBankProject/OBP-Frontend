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
 * Resource docs, cached per catalogue version for the life of the process.
 *
 * A full catalogue is large — ~6.7 MB for ~1,100 endpoints — and changes only when
 * OBP-API is deployed, so it is fetched once per version and kept. The browser is never
 * sent the whole thing: getResourceDocIndex() returns the trimmed index (~33 KB
 * gzipped) for search, and the selected endpoint is rendered on the server.
 *
 * The catalogue is readable anonymously, so `token` is optional throughout; pass one
 * only when you want the docs as that user sees them.
 *
 * Two things OBP does not support, learned the hard way:
 *   - `?operation_id=` is not a filter. It is ignored, and you get all 6.7 MB back.
 *     Filter in here instead. (`?tags=` and `?functions=` do filter server-side.)
 *   - Repeated query params are refused platform-wide with OBP-09016 before any route
 *     runs, so multi-tag filtering can never be pushed to the API.
 */
import { createLogger } from '$shared/utils/logger';
import type { ResourceDoc, ResourceDocIndexEntry } from '../../explorer/types.js';
import { buildIndex } from '../../explorer/indexEntry.js';
import { DEFAULT_META_VERSION, type ObpGetter } from './apiVersions.js';

const logger = createLogger('ResourceDocsCache');

/** Resource docs only change on an OBP-API deploy. */
const CACHE_DURATION = 30 * 60 * 1000;

interface VersionCache {
	docs: ResourceDoc[];
	index: ResourceDocIndexEntry[];
	lastFetched: number;
}

/** Which half of a catalogue to ask for; the API filters, so this is not a guess. */
export type ResourceDocContent = 'all' | 'static' | 'dynamic';

export interface ResourceDocsOptions {
	metaVersion?: string;
	token?: string;
	force?: boolean;
	/** 'all' by default, matching the endpoint's own default. */
	content?: ResourceDocContent;
}

/** Cached per catalogue *and* per content filter: they are three different responses. */
function cacheKey(fullyQualifiedVersion: string, content: ResourceDocContent): string {
	return content === 'all' ? fullyQualifiedVersion : `${fullyQualifiedVersion}?content=${content}`;
}

const cache = new Map<string, VersionCache>();
const inFlight = new Map<string, Promise<VersionCache>>();

function isFresh(entry: VersionCache | undefined): entry is VersionCache {
	return !!entry && Date.now() - entry.lastFetched < CACHE_DURATION;
}

async function load(
	obp: ObpGetter,
	fullyQualifiedVersion: string,
	options: ResourceDocsOptions
): Promise<VersionCache> {
	const { metaVersion = DEFAULT_META_VERSION, token, content = 'all' } = options;
	const query = content === 'all' ? '' : `?content=${content}`;
	const path = `/obp/${metaVersion}/resource-docs/${fullyQualifiedVersion}/obp${query}`;

	const response = await obp.get(path, token);
	const docs = (response?.resource_docs ?? []) as ResourceDoc[];
	const entry: VersionCache = { docs, index: buildIndex(docs), lastFetched: Date.now() };
	cache.set(cacheKey(fullyQualifiedVersion, content), entry);
	logger.info(`Cached ${docs.length} ${content} resource docs for ${fullyQualifiedVersion}`);
	return entry;
}

async function getVersionCache(
	obp: ObpGetter,
	fullyQualifiedVersion: string,
	options: ResourceDocsOptions = {}
): Promise<VersionCache> {
	const key = cacheKey(fullyQualifiedVersion, options.content ?? 'all');
	const existing = cache.get(key);
	if (!options.force && isFresh(existing)) return existing;

	// Collapse concurrent misses onto one fetch: a catalogue is far too big to fetch twice.
	const pending = inFlight.get(key);
	if (pending) return pending;

	const promise = load(obp, fullyQualifiedVersion, options).finally(() => {
		inFlight.delete(key);
	});
	inFlight.set(key, promise);
	return promise;
}

/** Every resource doc of one catalogue. Server-side only — this is the 6.7 MB. */
export async function fetchResourceDocs(
	obp: ObpGetter,
	fullyQualifiedVersion: string,
	options: ResourceDocsOptions = {}
): Promise<ResourceDoc[]> {
	return (await getVersionCache(obp, fullyQualifiedVersion, options)).docs;
}

/** The trimmed index of one catalogue — this is what the browser gets. */
export async function getResourceDocIndex(
	obp: ObpGetter,
	fullyQualifiedVersion: string,
	options: ResourceDocsOptions = {}
): Promise<ResourceDocIndexEntry[]> {
	return (await getVersionCache(obp, fullyQualifiedVersion, options)).index;
}

/** Fill a catalogue in the background; failures are logged, never thrown. */
export function preWarmResourceDocs(
	obp: ObpGetter,
	fullyQualifiedVersion: string,
	options: ResourceDocsOptions = {}
): void {
	if (isFresh(cache.get(cacheKey(fullyQualifiedVersion, options.content ?? 'all')))) return;
	getVersionCache(obp, fullyQualifiedVersion, options).catch((error) => {
		logger.warn(`Pre-warm failed for ${fullyQualifiedVersion}:`, error);
	});
}

export function getCacheStatus(): Array<{
	version: string;
	count: number;
	ageSeconds: number;
	isValid: boolean;
}> {
	return [...cache.entries()].map(([version, entry]) => ({
		version,
		count: entry.docs.length,
		ageSeconds: Math.round((Date.now() - entry.lastFetched) / 1000),
		isValid: isFresh(entry)
	}));
}

export function clearResourceDocsCache(fullyQualifiedVersion?: string): void {
	if (fullyQualifiedVersion) cache.delete(fullyQualifiedVersion);
	else cache.clear();
}
