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
const logger = createLogger('FinancialProductDetailServer');

import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import type { OBPProduct } from '$lib/obp/types';
import { obp_requests } from '$lib/obp/requests';
import { env } from '$env/dynamic/private';

const API_VERSION = 'v6.0.0';

export async function load(event: RequestEvent) {
	const bankId = event.params.bank_id;
	const productCode = event.params.product_code;
	const apiExplorerUrl = env.API_EXPLORER_URL || '';
	const token = event.locals.session?.data?.oauth?.access_token;

	if (!bankId || !productCode) {
		error(400, { message: 'Bank id and product code are required' });
	}

	let product: OBPProduct | null = null;
	try {
		const response = await obp_requests.get(
			`/obp/${API_VERSION}/banks/${encodeURIComponent(bankId)}/products/${encodeURIComponent(productCode)}`,
			token
		);
		product = response as OBPProduct;
	} catch (e) {
		logger.error(`Error fetching product ${productCode} at bank ${bankId}:`, e);
		error(404, { message: `Product not found: ${productCode} at ${bankId}` });
	}

	if (!product || !product.product_code) {
		error(404, { message: `Product not found: ${productCode} at ${bankId}` });
	}

	return {
		product,
		apiExplorerUrl,
		isLoggedIn: !!token
	};
}
