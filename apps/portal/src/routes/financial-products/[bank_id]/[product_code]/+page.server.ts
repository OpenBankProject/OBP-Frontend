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
