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
const logger = createLogger('FinancialProductsServer');

import type { RequestEvent } from '@sveltejs/kit';
import type { OBPProduct } from '$lib/obp/types';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError, OBPRateLimitError, OBPTimeoutError } from '@obp/shared/obp';
import { env } from '$env/dynamic/private';

const API_VERSION = 'v6.0.0';

export async function load(event: RequestEvent) {
	const apiExplorerUrl = env.API_EXPLORER_URL || '';
	const token = event.locals.session?.data?.oauth?.access_token;
	const isLoggedIn = !!token;

	const warnings: string[] = [];

	// First check if OBP-API is responding
	try {
		await obp_requests.get(`/obp/${API_VERSION}/root`);
	} catch (e) {
		const errorMsg = e instanceof OBPTimeoutError
			? 'OBP-API did not respond within 15 seconds. The server may be overloaded or down.'
			: e instanceof OBPRateLimitError
				? 'OBP-API rate limit exceeded. Please wait a moment and try again.'
				: 'OBP-API is not responding. Please check that the API server is running.';
		logger.error('OBP-API is not responding:', e);
		return {
			products: [] as OBPProduct[],
			warnings: [],
			message: errorMsg,
			apiExplorerUrl,
			isLoggedIn
		};
	}

	let products: OBPProduct[] = [];

	try {
		const productsResponse = await obp_requests.get(
			`/obp/${API_VERSION}/products?tag=featured`,
			token
		);
		products = productsResponse?.products || [];
		logger.info(`Fetched ${products.length} featured financial products across all banks`);
	} catch (e) {
		logger.error('Error fetching financial products at all banks:', e);
		if (e instanceof OBPRateLimitError) {
			warnings.push('API rate limit exceeded while loading financial products.');
		} else if (e instanceof OBPTimeoutError) {
			warnings.push('Request timed out loading financial products.');
		} else if (e instanceof OBPRequestError) {
			warnings.push(`Could not load financial products: ${e.message}`);
		} else {
			warnings.push('Could not load financial products.');
		}
	}

	// Sort products alphabetically by name
	products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

	return {
		products,
		warnings,
		apiExplorerUrl,
		isLoggedIn
	};
}
