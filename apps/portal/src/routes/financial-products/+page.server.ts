import { createLogger } from '$lib/utils/logger';
const logger = createLogger('FinancialProductsServer');

import type { RequestEvent } from '@sveltejs/kit';
import type { OBPProduct } from '$lib/obp/types';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError, OBPRateLimitError, OBPTimeoutError } from '$lib/obp/errors';
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
			error: errorMsg,
			apiExplorerUrl,
			isLoggedIn
		};
	}

	let products: OBPProduct[] = [];

	// First, get all banks
	let banks: Array<{ id: string }> = [];
	try {
		const banksResponse = await obp_requests.get(`/obp/${API_VERSION}/banks`);
		const rawBanks = banksResponse?.banks || [];
		banks = rawBanks.map((b: any) => ({ id: b.id || b.bank_id }));
		logger.info(`Found ${banks.length} banks: ${banks.map(b => b.id).join(', ')}`);
	} catch (e) {
		logger.error('Error fetching banks:', e);
		const errorMsg = e instanceof OBPRateLimitError
			? 'API rate limit exceeded while fetching banks. Please wait a moment and try again.'
			: e instanceof OBPTimeoutError
				? 'Request timed out while fetching banks. The API server may be overloaded.'
				: 'Could not fetch banks list.';
		return {
			products: [] as OBPProduct[],
			warnings: [],
			error: errorMsg,
			apiExplorerUrl,
			isLoggedIn
		};
	}

	// Fetch financial products from each bank
	for (const bank of banks) {
		try {
			const productsResponse = await obp_requests.get(
				`/obp/${API_VERSION}/banks/${bank.id}/products`,
				token
			);

			const rawProducts: OBPProduct[] = productsResponse?.products || [];
			if (rawProducts.length > 0) {
				// Filter to only products belonging to this bank
				const bankProducts = rawProducts.filter((p: OBPProduct) => p.bank_id === bank.id);
				const crossBankCount = rawProducts.length - bankProducts.length;
				if (crossBankCount > 0) {
					logger.warn(
						`GET /banks/${bank.id}/products returned ${crossBankCount} product(s) from other banks. Skipping these.`
					);
				}
				logger.info(`Found ${bankProducts.length} financial products in bank ${bank.id}`);
				products.push(...bankProducts);
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : String(e);
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

	logger.info(`Total financial products found across all banks: ${products.length}`);

	// Sort products alphabetically by name
	products.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

	return {
		products,
		warnings,
		apiExplorerUrl,
		isLoggedIn
	};
}
