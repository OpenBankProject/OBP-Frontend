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
import { createLogger } from '@obp/shared/utils';
const logger = createLogger('PublicCollectionServer');
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import type { OBPApiCollection, OBPApiCollectionEndpointsResponse } from '$lib/obp/types';
import { obp_requests } from '$lib/obp/requests';
import { env } from '$env/dynamic/private';

const API_VERSION = 'v6.0.0';

export async function load(event: RequestEvent) {
	const collectionId = event.params.collection_id;
	const token = event.locals.session?.data?.oauth?.access_token;

	// Fetch collection details (public endpoint for sharable collections)
	let collection: OBPApiCollection | undefined;
	try {
		collection = await obp_requests.get(
			`/obp/${API_VERSION}/api-collections/sharable/${collectionId}`,
			token
		);
	} catch (e) {
		logger.error('Error fetching API collection:', e);
		error(404, {
			message: 'API Collection not found or not sharable.'
		});
	}

	// Fetch endpoints in this collection
	let endpointsResponse: OBPApiCollectionEndpointsResponse | undefined;
	try {
		endpointsResponse = await obp_requests.get(
			`/obp/${API_VERSION}/api-collections/${collectionId}/api-collection-endpoints`,
			token
		);
	} catch (e) {
		logger.error('Error fetching collection endpoints:', e);
	}

	// Fetch resource docs to enrich endpoints with details
	let resourceDocs: any[] = [];
	try {
		const docsResponse = await obp_requests.get(
			`/obp/${API_VERSION}/resource-docs/${API_VERSION}/obp`,
			token
		);
		resourceDocs = docsResponse?.resource_docs || [];
	} catch (e) {
		logger.warn('Could not fetch resource docs for enrichment:', e);
	}

	// Create lookup map for resource docs
	const docsMap = new Map<string, any>();
	for (const doc of resourceDocs) {
		docsMap.set(doc.operation_id, doc);
	}

	// Enrich endpoints with resource doc info
	const endpoints = (endpointsResponse?.api_collection_endpoints || []).map(ep => {
		const doc = docsMap.get(ep.operation_id);
		return {
			...ep,
			summary: doc?.summary || '',
			description_markdown: doc?.description_markdown || '',
			request_verb: doc?.request_verb || '',
			request_url: doc?.specified_url || doc?.request_url || '',
			tags: doc?.tags || []
		};
	});

	return {
		collection,
		endpoints,
		collectionId,
		apiExplorerUrl: env.API_EXPLORER_URL || ''
	};
}
