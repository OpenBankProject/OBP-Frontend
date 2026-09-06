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
const logger = createLogger('UserApiCollectionDetailServer');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { error, fail } from '@sveltejs/kit';
import type { OBPApiCollection, OBPApiCollectionEndpointsResponse, OBPApiCollectionsResponse } from '$lib/obp/types';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';
import { env } from '$env/dynamic/private';
import { getOperationIds } from '$lib/obp/operationIdsCache';

const API_VERSION = 'v6.0.0';

export async function load(event: RequestEvent) {
	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		error(401, {
			message: 'Unauthorized: No access token found in session.'
		});
	}

	const collectionId = event.params.collection_id;

	// Fetch collection details
	let collection: OBPApiCollection | undefined;
	try {
		collection = await obp_requests.get(
			`/obp/${API_VERSION}/my/api-collections/${collectionId}`,
			token
		);
	} catch (e) {
		logger.error('Error fetching API collection:', e);
		error(404, {
			message: 'API Collection not found.'
		});
	}

	// Fetch endpoints in this collection (using collection ID endpoint)
	let endpointsResponse: OBPApiCollectionEndpointsResponse | undefined;
	try {
		endpointsResponse = await obp_requests.get(
			`/obp/${API_VERSION}/my/api-collection-ids/${collectionId}/api-collection-endpoints`,
			token
		);
	} catch (e) {
		logger.error('Error fetching collection endpoints:', e);
		// Don't fail, just return empty endpoints
	}

	const endpoints = endpointsResponse?.api_collection_endpoints || [];

	// Get cached operation IDs for search
	const availableOperations = await getOperationIds(API_VERSION, token);

	// Fetch all user's collections for "Copy From" dropdown
	let allCollections: OBPApiCollection[] = [];
	try {
		const collectionsResponse: OBPApiCollectionsResponse = await obp_requests.get(
			`/obp/${API_VERSION}/my/api-collections`,
			token
		);
		// Filter out the current collection
		allCollections = (collectionsResponse?.api_collections || [])
			.filter(c => c.api_collection_id !== collectionId)
			.sort((a, b) => a.api_collection_name.localeCompare(b.api_collection_name));
	} catch (e) {
		logger.warn('Could not fetch collections for copy dropdown:', e);
	}

	return {
		collection,
		endpoints,
		collectionId,
		apiExplorerUrl: env.API_EXPLORER_URL || '',
		availableOperations,
		allCollections
	};
}

export const actions = {
	addEndpoint: async ({ request, locals, params }) => {
		const data = await request.formData();
		const operationId = data.get('operation_id')?.toString();

		if (!operationId) {
			return fail(400, { message: 'Operation ID is required.' });
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return fail(401, { message: 'No access token found in session.' });
		}

		const collectionId = params.collection_id;

		try {
			await obp_requests.post(
				`/obp/${API_VERSION}/my/api-collection-ids/${collectionId}/api-collection-endpoints`,
				{ operation_id: operationId },
				token
			);
			return { success: true, message: 'Endpoint added successfully.' };
		} catch (err) {
			logger.error('Error adding endpoint to collection:', err);
			let errorMessage = 'Failed to add endpoint.';
			if (err instanceof OBPRequestError) {
				errorMessage = err.message;
			} else if (err instanceof Error) {
				errorMessage = err.message;
			}
			return fail(500, { message: errorMessage });
		}
	},

	removeEndpoint: async ({ request, locals, params }) => {
		const data = await request.formData();
		const endpointId = data.get('endpoint_id')?.toString();

		if (!endpointId) {
			return fail(400, { message: 'Endpoint ID is required.' });
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return fail(401, { message: 'No access token found in session.' });
		}

		const collectionId = params.collection_id;

		try {
			await obp_requests.delete(
				`/obp/${API_VERSION}/my/api-collection-ids/${collectionId}/api-collection-endpoint-ids/${endpointId}`,
				token
			);
			return { success: true, message: 'Endpoint removed successfully.' };
		} catch (err) {
			logger.error('Error removing endpoint from collection:', err);
			let errorMessage = 'Failed to remove endpoint.';
			if (err instanceof OBPRequestError) {
				errorMessage = err.message;
			} else if (err instanceof Error) {
				errorMessage = err.message;
			}
			return fail(500, { message: errorMessage });
		}
	},

	update: async ({ request, locals, params }) => {
		const data = await request.formData();
		const name = data.get('api_collection_name')?.toString();
		const description = data.get('description')?.toString() || '';
		const is_sharable = data.get('is_sharable') === 'true';

		if (!name) {
			return fail(400, { message: 'Collection name is required.' });
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return fail(401, { message: 'No access token found in session.' });
		}

		const collectionId = params.collection_id;

		try {
			await obp_requests.put(
				`/obp/${API_VERSION}/my/api-collections/${collectionId}`,
				{ api_collection_name: name, description, is_sharable },
				token
			);
			return { success: true, message: 'Collection updated successfully.' };
		} catch (err) {
			logger.error('Error updating API collection:', err);
			let errorMessage = 'Failed to update collection.';
			if (err instanceof OBPRequestError) {
				errorMessage = err.message;
			} else if (err instanceof Error) {
				errorMessage = err.message;
			}
			return fail(500, { message: errorMessage });
		}
	},

	copyFrom: async ({ request, locals, params }) => {
		const data = await request.formData();
		const sourceCollectionId = data.get('source_collection_id')?.toString();

		if (!sourceCollectionId) {
			return fail(400, { message: 'Source collection is required.' });
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return fail(401, { message: 'No access token found in session.' });
		}

		const targetCollectionId = params.collection_id;

		// Fetch endpoints from source collection
		let sourceEndpoints: { operation_id: string }[] = [];
		try {
			const response: OBPApiCollectionEndpointsResponse = await obp_requests.get(
				`/obp/${API_VERSION}/my/api-collection-ids/${sourceCollectionId}/api-collection-endpoints`,
				token
			);
			sourceEndpoints = response?.api_collection_endpoints || [];
		} catch (err) {
			logger.error('Error fetching source collection endpoints:', err);
			let errorMessage = 'Failed to fetch endpoints from source collection.';
			if (err instanceof OBPRequestError) {
				errorMessage = err.message;
			} else if (err instanceof Error) {
				errorMessage = err.message;
			}
			return fail(500, { message: errorMessage });
		}

		if (sourceEndpoints.length === 0) {
			return fail(400, { message: 'Source collection has no endpoints to copy.' });
		}

		// Copy each endpoint to target collection, ignoring duplicates
		let copiedCount = 0;
		let skippedCount = 0;
		for (const endpoint of sourceEndpoints) {
			try {
				await obp_requests.post(
					`/obp/${API_VERSION}/my/api-collection-ids/${targetCollectionId}/api-collection-endpoints`,
					{ operation_id: endpoint.operation_id },
					token
				);
				copiedCount++;
			} catch (err) {
				// If endpoint already exists, continue
				if (err instanceof OBPRequestError && err.message.includes('already exists')) {
					skippedCount++;
					continue;
				}
				// Log other errors but continue
				logger.warn(`Failed to copy endpoint ${endpoint.operation_id}:`, err);
				skippedCount++;
			}
		}

		const message = skippedCount > 0
			? `Copied ${copiedCount} endpoint(s). ${skippedCount} already existed.`
			: `Copied ${copiedCount} endpoint(s) successfully.`;

		return { success: true, message };
	}
} satisfies Actions;
