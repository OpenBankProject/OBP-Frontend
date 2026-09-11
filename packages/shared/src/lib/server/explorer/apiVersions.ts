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
 * The API versions OBP is serving, cached per process.
 *
 * GET /obp/{meta}/api/versions returns every scanned version across every standard —
 * obp, berlin-group, open-banking, stet, cds-au, polish-api and friends — plus the two
 * pseudo-versions for dynamic endpoints and dynamic entities. Its
 * `fully_qualified_version` ("OBPv7.0.0", "BGv1.3") is the catalogue identifier that
 * GET /resource-docs/{VERSION}/obp expects; the url_prefix and short version are the
 * first two segments of a request URL, which is how an Explorer endpoint link resolves
 * back to its catalogue.
 */
import { createLogger } from '$shared/utils/logger';
import type { ApiVersion } from '../../explorer/types.js';

const logger = createLogger('ApiVersionsCache');

/** Versions change only on an OBP-API deploy. */
const CACHE_DURATION = 30 * 60 * 1000;

/** The API version used to *ask* about versions, not one of the versions returned. */
export const DEFAULT_META_VERSION = 'v6.0.0';

export interface ObpGetter {
	get(endpoint: string, accessToken?: string): Promise<any>;
}

export interface ApiVersionOptions {
	metaVersion?: string;
	/** Optional: /api/versions and /resource-docs are both readable anonymously. */
	token?: string;
	force?: boolean;
}

let versions: ApiVersion[] = [];
let lastFetched: number | null = null;
let inFlight: Promise<ApiVersion[]> | null = null;

function toApiVersion(raw: any): ApiVersion {
	return {
		urlPrefix: String(raw?.url_prefix ?? ''),
		apiStandard: String(raw?.api_standard ?? ''),
		shortVersion: String(raw?.api_short_version ?? ''),
		fullyQualifiedVersion: String(raw?.fully_qualified_version ?? ''),
		isActive: raw?.is_active !== false
	};
}

export async function fetchApiVersions(
	obp: ObpGetter,
	options: ApiVersionOptions = {}
): Promise<ApiVersion[]> {
	const { metaVersion = DEFAULT_META_VERSION, token, force = false } = options;

	const fresh = lastFetched !== null && Date.now() - lastFetched < CACHE_DURATION;
	if (!force && fresh && versions.length > 0) return versions;
	if (inFlight) return inFlight;

	inFlight = (async () => {
		try {
			const response = await obp.get(`/obp/${metaVersion}/api/versions`, token);
			const scanned = (response?.scanned_api_versions ?? []) as any[];
			versions = scanned.map(toApiVersion).filter((v) => v.fullyQualifiedVersion);
			lastFetched = Date.now();
			logger.info(`Cached ${versions.length} API versions from OBP`);
			return versions;
		} finally {
			inFlight = null;
		}
	})();

	return inFlight;
}

/** Numeric-aware comparison of "v7.0.0" against "v1.2.1"; non-numeric versions sort last. */
function compareShortVersions(a: string, b: string): number {
	const parse = (v: string) => v.replace(/^v/, '').split('.').map((n) => Number(n));
	const av = parse(a);
	const bv = parse(b);
	if (av.some(Number.isNaN)) return bv.some(Number.isNaN) ? a.localeCompare(b) : 1;
	if (bv.some(Number.isNaN)) return -1;
	for (let i = 0; i < Math.max(av.length, bv.length); i++) {
		const diff = (av[i] ?? 0) - (bv[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

/** The newest numbered version of one standard — the Explorer's default catalogue. */
export function latestVersionFor(all: ApiVersion[], urlPrefix: string): ApiVersion | undefined {
	const numbered = all
		.filter((v) => v.urlPrefix === urlPrefix && v.isActive && /^v\d/.test(v.shortVersion))
		.sort((a, b) => compareShortVersions(a.shortVersion, b.shortVersion));
	return numbered[numbered.length - 1];
}

export function findVersion(
	all: ApiVersion[],
	urlPrefix: string,
	shortVersion: string
): ApiVersion | undefined {
	return all.find((v) => v.urlPrefix === urlPrefix && v.shortVersion === shortVersion);
}

export function findByFullyQualified(
	all: ApiVersion[],
	fullyQualifiedVersion: string
): ApiVersion | undefined {
	return all.find((v) => v.fullyQualifiedVersion === fullyQualifiedVersion);
}

/** Versions grouped for a picker: one group per standard, newest first within a group. */
export function groupByStandard(
	all: ApiVersion[]
): Array<{ urlPrefix: string; apiStandard: string; versions: ApiVersion[] }> {
	const groups = new Map<string, ApiVersion[]>();
	for (const v of all) {
		if (!v.isActive) continue;
		const list = groups.get(v.urlPrefix) ?? [];
		list.push(v);
		groups.set(v.urlPrefix, list);
	}
	return [...groups.entries()]
		.map(([urlPrefix, list]) => ({
			urlPrefix,
			apiStandard: list[0].apiStandard,
			versions: list.sort((a, b) => compareShortVersions(b.shortVersion, a.shortVersion))
		}))
		.sort((a, b) => (a.urlPrefix === 'obp' ? -1 : b.urlPrefix === 'obp' ? 1 : a.urlPrefix.localeCompare(b.urlPrefix)));
}

export function clearApiVersionsCache(): void {
	versions = [];
	lastFetched = null;
}
