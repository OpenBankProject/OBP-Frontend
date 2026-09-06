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
const logger = createLogger('UserApiCollectionsServer');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { error, fail } from '@sveltejs/kit';
import type { OBPApiCollection, OBPApiCollectionsResponse } from '$lib/obp/types';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';
import { env } from '$env/dynamic/private';

const API_VERSION = 'v6.0.0';

export async function load(event: RequestEvent) {
	const token = event.locals.session.data.oauth?.access_token;
	if (!token) {
		error(401, {
			message: 'Unauthorized: No access token found in session.'
		});
	}

	let collectionsResponse: OBPApiCollectionsResponse | undefined = undefined;

	try {
		collectionsResponse = await obp_requests.get(`/obp/${API_VERSION}/my/api-collections`, token);
	} catch (e) {
		logger.error('Error fetching API collections:', e);
		error(500, {
			message: 'Could not fetch API collections at this time. Please try again later.'
		});
	}

	if (!collectionsResponse || !collectionsResponse.api_collections) {
		return { collections: [], apiExplorerUrl: env.API_EXPLORER_URL || '' };
	}

	// Sort by name alphabetically
	const collections = collectionsResponse.api_collections.sort((a: OBPApiCollection, b: OBPApiCollection) =>
		a.api_collection_name.localeCompare(b.api_collection_name)
	);

	return { collections, apiExplorerUrl: env.API_EXPLORER_URL || '' };
}

export const actions = {
	create: async ({ request, locals }) => {
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

		const requestBody = {
			api_collection_name: name,
			description,
			is_sharable
		};

		try {
			await obp_requests.post(`/obp/${API_VERSION}/my/api-collections`, requestBody, token);
			return { success: true, message: 'API Collection created successfully.' };
		} catch (err) {
			logger.error('Error creating API collection:', err);
			let errorMessage = 'Failed to create API collection.';
			if (err instanceof OBPRequestError) {
				errorMessage = err.message;
			} else if (err instanceof Error) {
				errorMessage = err.message;
			}
			return fail(500, { message: errorMessage });
		}
	},

	delete: async ({ request, locals }) => {
		const data = await request.formData();
		const collectionId = data.get('api_collection_id');

		if (!collectionId) {
			return fail(400, { message: 'Collection ID is required.' });
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return fail(401, { message: 'No access token found in session.' });
		}

		try {
			await obp_requests.delete(`/obp/${API_VERSION}/my/api-collections/${collectionId}`, token);
			return { success: true, message: 'API Collection deleted successfully.' };
		} catch (err) {
			logger.error('Error deleting API collection:', err);
			let errorMessage = 'Failed to delete API collection.';
			if (err instanceof OBPRequestError) {
				errorMessage = err.message;
			} else if (err instanceof Error) {
				errorMessage = err.message;
			}
			return fail(500, { message: errorMessage });
		}
	}
} satisfies Actions;
