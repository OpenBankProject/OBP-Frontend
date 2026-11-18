/*
 * Copyright (C) 2026 TESOBE GmbH
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
import { env as publicEnv } from '$env/dynamic/public';
import { openApiOperations, parseOpenApiText, stepForOperation, type Operation } from '@obp/shared/conformator';
import { obpRequests } from './obp';
import { centralSpace } from './space';
import { requestApplicationAccessToken } from './applicationToken';
import type { EntityRecord } from './records';

/**
 * Where a suite's endpoints come from. Two paths:
 * - obp_version: a standard OBP implements, such as UKv3.1. Its OpenAPI document is OBP's own, served publicly by
 *   OBP-API's resource docs, and the OBP sandbox is the reference to run the suite against.
 * - openapi_url or openapi_dynamic: an OpenAPI file, at a URL or loaded into OBP as a dynamic endpoint set in the
 *   central space. Loaded with mock answers, the set answers each endpoint with the file's examples, so it is a
 *   reference too. The app serves a loaded file's document at /catalogue/<suite>/openapi.json.
 */

export type SourceKind = 'obp_version' | 'openapi_url' | 'openapi_dynamic' | '';

export interface ObpApiVersion {
	version: string;
	standard: string;
	/** The standard's name, such as "UK Open Banking". */
	standardName: string;
	/** The version within its standard, such as "v3.1". */
	shortVersion: string;
	label: string;
}

const CACHE_MS = 5 * 60 * 1000;
let versions: { at: number; list: ObpApiVersion[] } | null = null;
const documents = new Map<string, { at: number; document: unknown }>();

// The oldest OBP version offered as a suite's source, as a number: it filters the list and is not a path to call.
const OLDEST_OBP_VERSION = '5.0.0';
const STANDARD_ORDER = ['obp', 'UK', 'BG'];
const standardRank = (standard: string) => (STANDARD_ORDER.includes(standard) ? STANDARD_ORDER.indexOf(standard) : STANDARD_ORDER.length);

const standardNames: Record<string, string> = { UK: 'UK Open Banking', BG: 'Berlin Group', obp: 'Open Bank Project', STET: 'STET', AU: 'Australian CDR', MXOF: 'Mexico Open Finance' };

/**
 * The API versions OBP-API runs and documents: OBP's own (from v5.0.0) first, then UK Open Banking, Berlin Group and any others,
 * newest first within each standard. Its own dynamic endpoint and dynamic
 * entity versions are left out: a loaded OpenAPI file is the other path.
 */
export async function obpApiVersions(): Promise<ObpApiVersion[]> {
	if (versions && Date.now() - versions.at < CACHE_MS) return versions.list;
	const response = await obpRequests.get('/obp/v6.0.0/api/versions');
	const list: ObpApiVersion[] = (response?.scanned_api_versions ?? [])
		.filter((v: any) => v.is_active && !/dynamic-(endpoint|entity)/.test(String(v.fully_qualified_version)))
		// OBP's own versions before v5.0.0 are left out: a suite is written against a current version.
		.filter((v: any) => String(v.api_standard) !== 'obp' || String(v.api_short_version).replace(/^v/, '').localeCompare(OLDEST_OBP_VERSION, undefined, { numeric: true }) >= 0)
		.map((v: any) => {
			const standard = String(v.api_standard);
			const standardName = standardNames[standard] ?? standard;
			const shortVersion = String(v.api_short_version);
			return { version: String(v.fully_qualified_version), standard, standardName, shortVersion, label: `${standardName} ${shortVersion}` };
		})
		// OBP's own versions first, then UK Open Banking, Berlin Group and any others. Newest first within each
		// standard, so the current versions are in view.
		.sort((a: ObpApiVersion, b: ObpApiVersion) => standardRank(a.standard) - standardRank(b.standard) || a.standard.localeCompare(b.standard) || b.version.localeCompare(a.version, undefined, { numeric: true }));
	versions = { at: Date.now(), list };
	return list;
}

/** The address of OBP-API's own OpenAPI document for one of its API versions. Public: the runner reads it as it is. */
export function obpVersionOpenApiUrl(version: string): string {
	return `${(publicEnv.PUBLIC_OBP_BASE_URL ?? '').replace(/\/+$/, '')}/obp/v5.1.0/resource-docs/${encodeURIComponent(version)}/openapi`;
}

/** Where the app serves a suite's own document, after its ORIGIN. */
export function servedOpenApiPath(suiteId: string): string {
	return `/catalogue/${encodeURIComponent(suiteId)}/openapi.json`;
}

const dynamicEndpointsPath = () => `/obp/v5.1.0/management/banks/${encodeURIComponent(centralSpace())}/dynamic-endpoints`;

/** Why a file cannot be used as a suite's OpenAPI document, or null. */
export function openApiFileProblem(document: any): string | null {
	if (!document || typeof document !== 'object' || Array.isArray(document)) return 'The file is not an OpenAPI document: it holds no object at the top.';
	if (typeof document.openapi !== 'string' || !/^3\.[01]/.test(document.openapi))
		return `The file is not OpenAPI 3.0 or 3.1 (it says ${String(document.openapi ?? document.swagger ?? 'nothing')}).`;
	if (openApiOperations(document).length === 0) return 'The file has no operations under paths.';
	return null;
}

/**
 * Load an OpenAPI document into OBP as a dynamic endpoint set in the central space, with the User's own Role
 * (CanCreateBankLevelDynamicEndpoint there). With `mock`, its server is OBP's mock, so each endpoint answers with the
 * file's example response. Returns the set's id.
 */
export async function loadIntoDynamicEndpoints(document: Record<string, unknown>, mock: boolean, token: string): Promise<string> {
	const body = mock ? { ...document, servers: [{ url: 'obp_mock', description: 'OBP answers with the examples in this document' }] } : document;
	const created = await obpRequests.post(dynamicEndpointsPath(), body, token);
	const id = String(created?.dynamic_endpoint_id ?? '');
	if (!id) throw new Error('OBP-API did not give the new dynamic endpoint set an id.');
	return id;
}

/** A suite's OpenAPI document, read once every five minutes: from the dynamic endpoint set, or from its address. */
export async function suiteDocument(suite: EntityRecord): Promise<unknown | null> {
	const key = suite.dynamic_endpoint_id ? `de:${suite.dynamic_endpoint_id}` : String(suite.openapi_url ?? '');
	if (!key) return null;
	const cached = documents.get(key);
	if (cached && Date.now() - cached.at < CACHE_MS) return cached.document;
	let document: unknown;
	if (suite.dynamic_endpoint_id) {
		// Read with the app's own token: its Scope CanGetBankLevelDynamicEndpoint at the central space.
		const { token } = await requestApplicationAccessToken();
		const response = await obpRequests.get(`${dynamicEndpointsPath()}/${encodeURIComponent(String(suite.dynamic_endpoint_id))}`, token ?? undefined);
		document = response?.swagger_string;
	} else {
		const response = await fetch(String(suite.openapi_url), { signal: AbortSignal.timeout(30_000) });
		if (!response.ok) throw new Error(`${suite.openapi_url} answered ${response.status}.`);
		document = parseOpenApiText(await response.text());
	}
	documents.set(key, { at: Date.now(), document });
	return document;
}

/** The endpoints a suite's document offers for writing a step, grouped by tag, each with its ready-made step. */
export async function suiteEndpoints(suite: EntityRecord): Promise<{ endpoints: Array<Operation & { step: string }>; problem: string | null }> {
	try {
		const document = await suiteDocument(suite);
		if (!document) return { endpoints: [], problem: null };
		return { endpoints: openApiOperations(document).map((op) => ({ ...op, step: JSON.stringify(stepForOperation(op)) })), problem: null };
	} catch (err) {
		return { endpoints: [], problem: `The suite's OpenAPI document could not be read: ${err instanceof Error ? err.message : String(err)}` };
	}
}
