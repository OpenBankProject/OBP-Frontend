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
 * The API Explorer URL contract.
 *
 * There are two shapes, and both must keep working.
 *
 * Canonical (new). The Explorer URL mirrors the call a developer would actually make,
 * so it can be typed by hand from a curl command and read without a decoder ring:
 *
 *   {base}/obp/v7.0.0                            a catalogue, with ?tag= and ?q= filters
 *   {base}/endpoint/GET/obp/v7.0.0/banks         one endpoint
 *   {base}/endpoint/GET/berlin-group/v1.3/accounts
 *
 * The endpoint path is self-describing: its first two segments are the url_prefix and
 * the version, which is exactly the catalogue the doc lives in, so a deep link needs no
 * other context to resolve.
 *
 * Legacy (API Explorer II). Kept because it is already load-bearing — the API Manager's
 * glossary, message-docs and other pages link with it today via explorerResourceDocUrl:
 *
 *   {base}/resource-docs/OBPv7.0.0?operationid=OBPv6.0.0-getBanks
 *
 * These redirect to the canonical shape. Matching the legacy contract is what makes
 * API_EXPLORER_URL the whole cutover: point it at the Portal and every existing link
 * resolves in-app; point it back and nothing has changed.
 */
import type { ApiVersion } from './types.js';

/** Where the Explorer lives inside the Portal. */
export const INTERNAL_EXPLORER_BASE = '/api-explorer';

/** Fallback when API_EXPLORER_URL is unset. The one place this URL should appear. */
export const DEFAULT_EXTERNAL_EXPLORER_URL = 'https://apiexplorer-ii-sandbox.openbankproject.com';

/** Strip a trailing slash and any query string, so a base can be concatenated safely. */
export function normalizeExplorerBase(url: string | undefined | null): string {
	return String(url || '')
		.replace(/\/?\?.*$/, '')
		.replace(/\/$/, '');
}

function encodePath(path: string): string {
	return path
		.split('/')
		.map((seg) => encodeURIComponent(seg))
		.join('/');
}

/** A catalogue: every endpoint of one standard at one version. */
export function explorerCatalogueUrl(
	urlPrefix: string,
	shortVersion: string,
	options: { base?: string; tag?: string; q?: string } = {}
): string {
	const base = normalizeExplorerBase(options.base ?? INTERNAL_EXPLORER_BASE);
	const params = new URLSearchParams();
	if (options.tag) params.set('tag', options.tag);
	if (options.q) params.set('q', options.q);
	const query = params.toString();
	return `${base}/${encodeURIComponent(urlPrefix)}/${encodeURIComponent(shortVersion)}${query ? `?${query}` : ''}`;
}

/** One endpoint, addressed the way it is called. */
export function explorerEndpointUrl(
	verb: string,
	path: string,
	options: { base?: string } = {}
): string {
	const base = normalizeExplorerBase(options.base ?? INTERNAL_EXPLORER_BASE);
	const p = path.startsWith('/') ? path : `/${path}`;
	return `${base}/endpoint/${verb.toUpperCase()}${encodePath(p)}`;
}

/**
 * Split an endpoint path into the catalogue that holds it.
 * "/obp/v7.0.0/banks" -> { urlPrefix: "obp", shortVersion: "v7.0.0" }
 */
export function catalogueFromEndpointPath(
	path: string
): { urlPrefix: string; shortVersion: string } | undefined {
	const segments = path.split('/').filter(Boolean);
	if (segments.length < 2) return undefined;
	return { urlPrefix: segments[0], shortVersion: segments[1] };
}

/** Match a path's first two segments against the scanned API versions. */
export function apiVersionForEndpointPath(
	versions: ApiVersion[],
	path: string
): ApiVersion | undefined {
	const parts = catalogueFromEndpointPath(path);
	if (!parts) return undefined;
	return versions.find(
		(v) => v.urlPrefix === parts.urlPrefix && v.shortVersion === parts.shortVersion
	);
}

/**
 * Which catalogue an Explorer page is showing, read back off its own URL. The shell
 * (left nav, version picker) needs this before the page's own load has run, and both
 * URL shapes carry it:
 *
 *   {base}/obp/v7.0.0                        -> obp / v7.0.0
 *   {base}/endpoint/GET/obp/v7.0.0/banks     -> obp / v7.0.0
 */
export function catalogueFromExplorerPathname(
	pathname: string,
	base: string = INTERNAL_EXPLORER_BASE
): { urlPrefix: string; shortVersion: string } | undefined {
	const prefix = normalizeExplorerBase(base);
	if (!pathname.startsWith(prefix)) return undefined;

	const segments = pathname
		.slice(prefix.length)
		.split('/')
		.filter(Boolean)
		.map((s) => decodeURIComponent(s));

	// /endpoint/{VERB}/{urlPrefix}/{version}/...
	if (segments[0] === 'endpoint') {
		if (segments.length < 4) return undefined;
		return { urlPrefix: segments[2], shortVersion: segments[3] };
	}
	// /{urlPrefix}/{version}
	if (segments.length >= 2 && segments[0] !== 'resource-docs') {
		return { urlPrefix: segments[0], shortVersion: segments[1] };
	}
	return undefined;
}

/* ---------------------------------------------------------------- legacy shapes */

/**
 * API Explorer II's resource-doc URL. Still emitted by API Manager pages, so the
 * Portal serves it as a redirect to the canonical endpoint URL.
 */
export function explorerResourceDocUrl(
	operationId: string,
	explorerUrl: string = DEFAULT_EXTERNAL_EXPLORER_URL
): string {
	const version = operationId.match(/^(OBPv[0-9.]+)-/)?.[1] ?? 'OBPv7.0.0';
	return `${normalizeExplorerBase(explorerUrl)}/resource-docs/${version}?operationid=${encodeURIComponent(operationId)}`;
}

/** API Explorer II's page for one glossary entry. */
export function glossaryEntryUrl(
	title: string,
	explorerUrl: string = DEFAULT_EXTERNAL_EXPLORER_URL
): string {
	return `${normalizeExplorerBase(explorerUrl)}/glossary#${encodeURIComponent(title)}`;
}

/**
 * Glossary markdown links between entries are site-relative to the API Explorer
 * (`[here](/glossary#Title)`). Point them somewhere that resolves.
 */
export function rewriteGlossaryLinks(
	markdown: string,
	explorerUrl: string = DEFAULT_EXTERNAL_EXPLORER_URL
): string {
	return markdown.replace(/\]\(\/glossary#/g, `](${normalizeExplorerBase(explorerUrl)}/glossary#`);
}
