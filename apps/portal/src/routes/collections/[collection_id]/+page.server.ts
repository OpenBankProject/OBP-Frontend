import { createLogger } from '$lib/utils/logger';
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
