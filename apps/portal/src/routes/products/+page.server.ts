import { createLogger } from '$lib/utils/logger';
const logger = createLogger('ProductsServer');

import type { RequestEvent } from '@sveltejs/kit';
import type { OBPProduct, APIProductDetails } from '$lib/obp/types';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError, OBPRateLimitError, OBPTimeoutError } from '$lib/obp/errors';
import { env } from '$env/dynamic/private';

const API_VERSION = 'v6.0.0';

/**
 * Map an API Product response directly to APIProductDetails.
 * Reads first-class fields from the API Product response.
 */
function mapApiProductDetails(apiProduct: any): APIProductDetails {
	const product: OBPProduct = {
		bank_id: apiProduct.bank_id,
		product_code: apiProduct.api_product_code,
		parent_product_code: apiProduct.parent_api_product_code,
		name: apiProduct.name,
		more_info_url: apiProduct.more_info_url,
		terms_and_conditions_url: apiProduct.terms_and_conditions_url,
		description: apiProduct.description,
		meta: apiProduct.meta,
		product_attributes: apiProduct.attributes || []
	};

	return {
		product,
		apiCollectionId: apiProduct.collection_id || undefined,
		category: apiProduct.category || undefined,
		priceMonthly: apiProduct.monthly_subscription_amount
			? parseFloat(apiProduct.monthly_subscription_amount)
			: undefined,
		priceCurrency: apiProduct.monthly_subscription_currency || undefined,
		rateLimitPerSecond: apiProduct.per_second_call_limit || undefined,
		rateLimitPerMinute: apiProduct.per_minute_call_limit || undefined,
		rateLimitPerHour: apiProduct.per_hour_call_limit || undefined,
		rateLimitPerDay: apiProduct.per_day_call_limit || undefined,
		rateLimitPerWeek: apiProduct.per_week_call_limit || undefined,
		rateLimitPerMonth: apiProduct.per_month_call_limit || undefined
	};
}

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
			products: [],
			warnings: [],
			error: errorMsg,
			apiExplorerUrl,
			isLoggedIn
		};
	}

	// Fetch products from all banks
	let products: APIProductDetails[] = [];
	const debugInfo: {
		banksFound: number;
		bankIds: string[];
		rawBanksResponse?: any;
		productResponses: Array<{ bankId: string; response?: any; error?: string }>;
	} = {
		banksFound: 0,
		bankIds: [],
		productResponses: []
	};

	// First, get all banks
	let banks: Array<{ id: string }> = [];
	try {
		const banksResponse = await obp_requests.get(`/obp/${API_VERSION}/banks`);
		debugInfo.rawBanksResponse = banksResponse;
		const rawBanks = banksResponse?.banks || [];
		banks = rawBanks.map((b: any) => ({ id: b.id || b.bank_id }));
		debugInfo.banksFound = banks.length;
		debugInfo.bankIds = banks.map(b => b.id);
		logger.info(`Found ${banks.length} banks: ${banks.map(b => b.id).join(', ')}`);
	} catch (e) {
		logger.error('Error fetching banks:', e);
		const errorMsg = e instanceof OBPRateLimitError
			? 'API rate limit exceeded while fetching banks. Please wait a moment and try again.'
			: e instanceof OBPTimeoutError
				? 'Request timed out while fetching banks. The API server may be overloaded.'
				: 'Could not fetch banks list.';
		return {
			products: [],
			warnings: [],
			error: errorMsg,
			apiExplorerUrl,
			isLoggedIn,
			debug: debugInfo
		};
	}

	// Fetch API Products from each bank using the dedicated api-products endpoint
	for (const bank of banks) {
		try {
			const apiProductsResponse = await obp_requests.get(
				`/obp/${API_VERSION}/banks/${bank.id}/api-products`,
				token
			);
			debugInfo.productResponses.push({ bankId: bank.id, response: apiProductsResponse });

			const rawApiProducts = apiProductsResponse?.api_products || [];
			if (rawApiProducts.length > 0) {
				// Filter to only products belonging to this bank
				const bankProducts = rawApiProducts.filter((p: any) => p.bank_id === bank.id);
				const crossBankCount = rawApiProducts.length - bankProducts.length;
				if (crossBankCount > 0) {
					logger.warn(
						`GET /banks/${bank.id}/api-products returned ${crossBankCount} product(s) from other banks. Skipping these.`
					);
				}
				logger.info(`Found ${bankProducts.length} API products in bank ${bank.id}`);

				for (const apiProduct of bankProducts) {
					products.push(mapApiProductDetails(apiProduct));
				}
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : String(e);
			debugInfo.productResponses.push({ bankId: bank.id, error: errorMsg });
			if (e instanceof OBPRateLimitError) {
				warnings.push(`API rate limit reached while loading products from bank "${bank.id}". Some products may be missing.`);
				logger.warn('Rate limit hit, stopping bank iteration early');
				break;
			}
			if (e instanceof OBPTimeoutError) {
				warnings.push(`Request timed out loading products from bank "${bank.id}". Some products may be missing.`);
			}
			if (e instanceof OBPRequestError) {
				warnings.push(e.message);
			}
		}
	}

	logger.info(`Total products found across all banks: ${products.length}`);

	// Sort products by price (free first, then ascending)
	products.sort((a, b) => {
		const priceA = a.priceMonthly ?? 0;
		const priceB = b.priceMonthly ?? 0;
		return priceA - priceB;
	});

	return {
		products,
		warnings,
		apiExplorerUrl,
		isLoggedIn,
		debug: debugInfo
	};
}
