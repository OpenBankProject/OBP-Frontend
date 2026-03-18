import { createLogger } from '$lib/utils/logger';
const logger = createLogger('FeaturedEndpointsServer');

function logDebug(message: string) {
	console.log(`[FEATURED-DEBUG] ${message}`);
}
import type { RequestEvent } from '@sveltejs/kit';
import type { OBPApiCollectionsResponse, OBPApiCollectionEndpointsResponse } from '$lib/obp/types';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError, OBPErrorBase } from '$lib/obp/errors';
import { env } from '$env/dynamic/private';

const API_VERSION = 'v6.0.0';

export interface FeaturedEndpoint {
	operation_id: string;
	request_verb?: string;
	request_url?: string;
	summary?: string;
	description?: string;
	description_markdown?: string;
	tags?: string[];
}

export async function load(event: RequestEvent) {
	const apiExplorerUrl = env.API_EXPLORER_URL || '';
	const token = event.locals.session?.data?.oauth?.access_token;

	// First check if OBP-API is responding by calling /root
	try {
		await obp_requests.get(`/obp/${API_VERSION}/root`);
	} catch (e) {
		logger.error('OBP-API is not responding:', e);
		return { endpoints: [], error: 'OBP-API is not responding. Please check that the API server is running.', apiExplorerUrl };
	}

	// Fetch featured collections (public endpoint)
	let collectionsResponse: OBPApiCollectionsResponse | undefined;
	try {
		collectionsResponse = await obp_requests.get(`/obp/${API_VERSION}/api-collections/featured`);
	} catch (e) {
		let errorMsg: string;
		if (e instanceof OBPRequestError) {
			errorMsg = e.message;
		} else if (e instanceof OBPErrorBase) {
			errorMsg = e.message;
		} else if (e instanceof Error) {
			errorMsg = e.message;
		} else {
			errorMsg = String(e);
		}
		logger.error('Error fetching featured API collections:', errorMsg);
		return { endpoints: [], error: errorMsg, apiExplorerUrl };
	}

	if (!collectionsResponse?.api_collections?.length) {
		return { endpoints: [], message: 'No featured collections available.', apiExplorerUrl };
	}

	// Collect all unique operation_ids from featured collections
	const allEndpoints: FeaturedEndpoint[] = [];
	const seenOperationIds = new Set<string>();

	for (const collection of collectionsResponse.api_collections) {
		try {
			// Fetch endpoints for this collection (public endpoint)
			const endpointsResponse: OBPApiCollectionEndpointsResponse = await obp_requests.get(
				`/obp/${API_VERSION}/api-collections/${collection.api_collection_id}/api-collection-endpoints`
			);

			if (endpointsResponse?.api_collection_endpoints) {
				for (const ep of endpointsResponse.api_collection_endpoints) {
					if (!seenOperationIds.has(ep.operation_id)) {
						seenOperationIds.add(ep.operation_id);
						allEndpoints.push({
							operation_id: ep.operation_id
						});
					}
				}
			}
		} catch (e) {
			let errorMsg: string;
			if (e instanceof OBPRequestError) {
				errorMsg = e.message;
			} else if (e instanceof OBPErrorBase) {
				errorMsg = e.message;
			} else if (e instanceof Error) {
				errorMsg = e.message;
			} else {
				errorMsg = String(e);
			}
			logger.error(`Error fetching endpoints for collection ${collection.api_collection_id}: ${errorMsg}`);
		}
	}

	// If not enough endpoints from featured collections, supplement with popular endpoints
	const MIN_ENDPOINTS = 20;
	if (allEndpoints.length < MIN_ENDPOINTS) {
		try {
			const popularResponse = await obp_requests.get(`/obp/${API_VERSION}/api/popular-endpoints`);

			if (popularResponse?.operation_ids && popularResponse.operation_ids.length > 0) {
				logDebug(`Popular endpoints returned ${popularResponse.operation_ids.length} operation_ids`);
				logDebug(`Sample popular operation_ids: ${popularResponse.operation_ids.slice(0, 5).join(', ')}`);

				// Shuffle and take enough to reach MIN_ENDPOINTS
				const shuffled = [...popularResponse.operation_ids].sort(() => Math.random() - 0.5);
				const needed = MIN_ENDPOINTS - allEndpoints.length;
				const selected = shuffled.slice(0, needed);

				for (const operationId of selected) {
					if (!seenOperationIds.has(operationId)) {
						seenOperationIds.add(operationId);
						allEndpoints.push({
							operation_id: operationId
						});
					}
				}
			}
		} catch (e) {
			let errorMsg: string;
			if (e instanceof OBPRequestError) {
				errorMsg = e.message;
			} else if (e instanceof OBPErrorBase) {
				errorMsg = e.message;
			} else if (e instanceof Error) {
				errorMsg = e.message;
			} else {
				errorMsg = String(e);
			}
			logger.error('Error fetching popular endpoints:', errorMsg);
		}
	}

	// Enrich with resource docs (call with auth if logged in, without if not)
	if (allEndpoints.length > 0) {
		try {
			const resourceDocs = await obp_requests.get(
				`/obp/${API_VERSION}/resource-docs/${API_VERSION}/obp`,
				token
			);

			if (resourceDocs?.resource_docs) {
				// Create a lookup map
				const docsMap = new Map<string, any>();
				for (const doc of resourceDocs.resource_docs) {
					docsMap.set(doc.operation_id, doc);
				}

				// Helper to extract function name from operation_id (e.g., "OBPv5.1.0-getMetrics" -> "getMetrics")
				const getFunctionName = (opId: string): string => {
					const match = opId.match(/^OBPv[\d.]+-(.+)$/);
					return match ? match[1] : opId;
				};

				// Create a secondary lookup map by function name for fallback matching
				const docsByFunctionName = new Map<string, any>();
				for (const doc of resourceDocs.resource_docs) {
					const funcName = getFunctionName(doc.operation_id);
					// Only store if not already present (prefer first/latest version)
					if (!docsByFunctionName.has(funcName)) {
						docsByFunctionName.set(funcName, doc);
					}
				}

				// Enrich endpoints with doc info
				let enrichedCount = 0;
				const notFound: string[] = [];
				for (const endpoint of allEndpoints) {
					// First try exact match
					let doc = docsMap.get(endpoint.operation_id);

					// If not found, try matching by function name (handles version mismatches)
					if (!doc) {
						const funcName = getFunctionName(endpoint.operation_id);
						doc = docsByFunctionName.get(funcName);
					}

					if (doc) {
						endpoint.request_verb = doc.request_verb || 'GET';
						endpoint.request_url = doc.specified_url || doc.request_url || '';
						endpoint.summary = doc.summary || '';
						endpoint.description = doc.description || '';
						endpoint.description_markdown = doc.description_markdown || '';
						endpoint.tags = doc.tags || [];
						enrichedCount++;
					} else {
						notFound.push(endpoint.operation_id);
					}
				}
				if (notFound.length > 0) {
					logDebug(`No resource doc found for: ${notFound.join(', ')}`);
				}
				logDebug(`Enriched ${enrichedCount} of ${allEndpoints.length} endpoints`);
			}
		} catch (e) {
			logger.warn('Could not fetch resource docs for enrichment:', e);
			// Continue without enrichment
		}
	}

	// Sort by operation_id for consistent ordering
	allEndpoints.sort((a, b) => a.operation_id.localeCompare(b.operation_id));

	return { endpoints: allEndpoints, apiExplorerUrl };
};
