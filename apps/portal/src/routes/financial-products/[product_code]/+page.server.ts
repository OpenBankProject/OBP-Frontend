import { createLogger } from '$lib/utils/logger';
const logger = createLogger('FinancialProductDetailServer');

import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import type { OBPProduct } from '$lib/obp/types';
import { obp_requests } from '$lib/obp/requests';
import { env } from '$env/dynamic/private';

const API_VERSION = 'v6.0.0';

export async function load(event: RequestEvent) {
	const productCode = event.params.product_code;
	const apiExplorerUrl = env.API_EXPLORER_URL || '';
	const token = event.locals.session?.data?.oauth?.access_token;

	if (!productCode) {
		error(400, { message: 'Product code is required' });
	}

	// First, get all banks
	let banks: Array<{ id: string }> = [];
	try {
		const banksResponse = await obp_requests.get(`/obp/${API_VERSION}/banks`);
		const rawBanks = banksResponse?.banks || [];
		banks = rawBanks.map((b: any) => ({ id: b.id || b.bank_id }));
	} catch (e) {
		logger.error('Error fetching banks:', e);
		error(500, { message: 'Could not fetch banks list.' });
	}

	// Search for the product across all banks
	let product: OBPProduct | null = null;

	for (const bank of banks) {
		try {
			const productsResponse = await obp_requests.get(
				`/obp/${API_VERSION}/banks/${bank.id}/products`,
				token
			);

			const products: OBPProduct[] = productsResponse?.products || [];
			const match = products.find((p: OBPProduct) => p.product_code === productCode);
			if (match) {
				product = match;
				logger.info(`Found financial product ${productCode} in bank ${bank.id}`);
				break;
			}
		} catch (e) {
			// Product not found in this bank, continue searching
		}
	}

	if (!product) {
		error(404, { message: `Product not found: ${productCode}` });
	}

	return {
		product,
		apiExplorerUrl,
		isLoggedIn: !!token
	};
}
