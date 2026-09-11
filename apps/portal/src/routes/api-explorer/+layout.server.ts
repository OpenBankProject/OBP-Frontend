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
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { obp_requests } from '$lib/obp/requests';
import {
	catalogueFromExplorerPathname,
	collectTags,
	explorerGlossaryTitleUrl,
	explorerMessageDocsUrl,
	DEFAULT_EXTERNAL_EXPLORER_URL
} from '@obp/shared/explorer';
import {
	fetchApiVersions,
	findVersion,
	getResourceDocIndex,
	groupByStandard,
	latestVersionFor,
	loadGlossaryIndex,
	loadMessageDocIndex,
	MESSAGE_DOC_CONNECTORS,
	connectorLabel
} from '@obp/shared/server/explorer';
import type { LayoutServerLoad } from './$types';

/**
 * The Explorer shell: the left bar and the version picker, which belong to the whole
 * Explorer rather than to one page.
 *
 * The bar shows whatever the current section navigates — endpoints, glossary entries,
 * a connector's messages, gRPC services — so the section is read off the pathname and only
 * that section's list is loaded. The catalogue is still read for the version picker and
 * endpoint count, which are cheap once cached.
 */
type Section = 'endpoints' | 'glossary' | 'message-docs' | 'grpc';

function sectionFor(pathname: string): Section {
	const rest = pathname.replace(/^\/api-explorer\/?/, '');
	if (rest.startsWith('glossary')) return 'glossary';
	if (rest.startsWith('message-docs')) return 'message-docs';
	if (rest.startsWith('grpc')) return 'grpc';
	return 'endpoints';
}

export const load: LayoutServerLoad = async ({ url }) => {
	const section = sectionFor(url.pathname);
	const baseUrl = publicEnv.PUBLIC_OBP_BASE_URL ?? '';

	const versions = await fetchApiVersions(obp_requests);
	const fromPath = catalogueFromExplorerPathname(url.pathname);
	const current =
		(fromPath && findVersion(versions, fromPath.urlPrefix, fromPath.shortVersion)) ||
		latestVersionFor(versions, 'obp');

	// static | dynamic | all — the endpoint filters this, so the count in the bar is the
	// API's answer rather than ours. Anything else in the URL falls back to 'all'.
	const requested = url.searchParams.get('content');
	const content: 'all' | 'static' | 'dynamic' =
		requested === 'static' || requested === 'dynamic' ? requested : 'all';

	const index =
		current && section === 'endpoints'
			? await getResourceDocIndex(obp_requests, current.fullyQualifiedVersion, { content })
			: [];

	// Only the section on screen pays for its list.
	let listGroups: Array<{ name: string; items: Array<{ label: string; href: string; note?: string }> }> = [];
	let listPlaceholder = 'Search';
	let navError: string | null = null;

	try {
		if (section === 'glossary') {
			listPlaceholder = 'Search the glossary';
			const { rows } = await loadGlossaryIndex({ baseUrl });
			listGroups = [
				{
					name: '',
					items: rows.map((r) => ({
						label: r.title,
						href: explorerGlossaryTitleUrl(r.title),
						note: r.is_dynamic ? 'dynamic' : undefined
					}))
				}
			];
		} else if (section === 'message-docs') {
			listPlaceholder = 'Search messages';
			const connector = url.pathname.split('/')[3] ?? '';
			listGroups = [
				{
					name: 'Connectors',
					items: MESSAGE_DOC_CONNECTORS.map((c) => ({
						label: c.label,
						href: explorerMessageDocsUrl(c.name)
					}))
				}
			];
			if (connector) {
				const { rows } = await loadMessageDocIndex(obp_requests, connector);
				listGroups.push({
					name: connectorLabel(connector),
					items: rows.map((r) => ({
						label: r.process,
						href: explorerMessageDocsUrl(connector, r.process),
						note: r.suggested_order !== null ? String(r.suggested_order) : undefined
					}))
				});
			}
		}
	} catch (e) {
		// A failing list must not take the page with it; the body still renders.
		navError = e instanceof Error ? e.message : String(e);
	}

	return {
		section,
		current,
		versionGroups: groupByStandard(versions),
		index,
		content,
		tags: collectTags(index),
		listGroups,
		listPlaceholder,
		navError,
		obpBaseUrl: baseUrl,
		opeyBaseUrl: publicEnv.PUBLIC_OPEY_BASE_URL ?? '',
		externalExplorerUrl: String(env.API_EXPLORER_URL || DEFAULT_EXTERNAL_EXPLORER_URL)
	};
};
