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
import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { obp_requests } from '$lib/obp/requests';
import {
	apiVersionForEndpointPath,
	endpointPath,
	findDocByEndpoint,
	explorerResourceDocUrl,
	explorerGlossaryTitleUrl,
	glossaryEntryUrl,
	parseDescription,
	rewriteGlossaryLinks,
	DEFAULT_EXTERNAL_EXPLORER_URL
} from '@obp/shared/explorer';
import { env as publicEnv } from '$env/dynamic/public';
import {
	fetchApiVersions,
	fetchResourceDocs,
	glossaryAnchorResolver
} from '@obp/shared/server/explorer';
import { renderMarkdown } from '@obp/shared/markdown';
import type { PageServerLoad } from './$types';

/**
 * One endpoint, addressed as it is called: /api-explorer/endpoint/GET/obp/v7.0.0/banks.
 *
 * The path resolves its own catalogue — its first two segments are the url_prefix and
 * version — so a deep link needs no other context. Verb plus path is unique within a
 * catalogue (measured: 1143 of 1143 docs, no collisions), which the function name is not.
 *
 * Rendered on the server: these URLs get pasted into tickets and chat, and should show
 * the endpoint without waiting for hydration.
 */
export const load: PageServerLoad = async ({ params }) => {
	const verb = params.verb.toUpperCase();
	const path = `/${params.path}`;

	const versions = await fetchApiVersions(obp_requests);
	const version = apiVersionForEndpointPath(versions, path);
	if (!version) {
		error(404, `No API version serves ${path}`);
	}

	const docs = await fetchResourceDocs(obp_requests, version.fullyQualifiedVersion);
	const doc = findDocByEndpoint(docs, verb, path);
	if (!doc) {
		error(404, `No endpoint ${verb} ${path} in ${version.fullyQualifiedVersion}`);
	}

	const externalExplorerUrl = String(env.API_EXPLORER_URL || DEFAULT_EXTERNAL_EXPLORER_URL);

	/**
	 * Most descriptions end in a glossary of every body field — a median 41% of the text,
	 * one bold underlined paragraph per field. Lifted out of the prose it becomes a
	 * reference list the page can fold away, leaving the sentences that explain the
	 * endpoint. Glossary links are site-relative to the Explorer, so they are pointed at
	 * one that serves a glossary.
	 */
	const described = parseDescription(doc.description_markdown ?? '');

	/**
	 * Field names link into the glossary by anchor ("/glossary#Bank.bank_id"), which is not
	 * always the entry's title. The glossary's own anchor map resolves them, so a term the
	 * Explorer has links to its page here; anything else falls back to the external
	 * Explorer rather than 404ing. Never fatal: an unreachable glossary just means the terms
	 * link out.
	 */
	let anchorToTitle: (anchor: string) => string | undefined = () => undefined;
	try {
		anchorToTitle = await glossaryAnchorResolver({ baseUrl: publicEnv.PUBLIC_OBP_BASE_URL ?? '' });
	} catch {
		anchorToTitle = () => undefined;
	}

	const glossaryHref = (href: string | undefined): string | undefined => {
		if (!href?.startsWith('/glossary#')) return href;
		const anchor = href.slice('/glossary#'.length);
		const title = anchorToTitle(anchor);
		return title ? explorerGlossaryTitleUrl(title) : glossaryEntryUrl(anchor, externalExplorerUrl);
	};
	const sections = described.sections.map((section) => ({
		title: section.title,
		extraHtml: section.extra ? renderMarkdown(rewriteGlossaryLinks(section.extra, externalExplorerUrl)) : '',
		fields: section.fields.map((field) => ({
			name: field.name,
			href: glossaryHref(field.glossaryHref),
			text: field.text
		}))
	}));

	return {
		version,
		endpoint: {
			operationId: doc.operation_id,
			verb,
			path: endpointPath(doc),
			requestUrl: doc.request_url,
			summary: doc.summary ?? '',
			descriptionHtml: described.prose
				? renderMarkdown(rewriteGlossaryLinks(described.prose, externalExplorerUrl))
				: (doc.description_markdown ? '' : (doc.description ?? '')),
			sections,
			roles: doc.roles ?? [],
			tags: doc.tags ?? [],
			implementedBy: doc.implemented_by ?? null,
			connectorMethods: doc.connector_methods ?? [],
			exampleRequestBody: doc.example_request_body ?? null,
			successResponseBody: doc.success_response_body ?? null,
			errorResponseBodies: doc.error_response_bodies ?? [],
			specialInstructions: doc.special_instructions ?? ''
		},
		/**
		 * Try-it-out is not built here yet, so every endpoint keeps a one-click route to
		 * the Explorer that does have it.
		 */
		tryItOutUrl: explorerResourceDocUrl(doc.operation_id, externalExplorerUrl)
	};
};
