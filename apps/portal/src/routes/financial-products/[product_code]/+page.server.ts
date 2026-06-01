import { createLogger } from '@obp/shared/utils';
const logger = createLogger('FinancialProductRedirectServer');

import type { RequestEvent } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import type { OBPProduct } from '$lib/obp/types';
import { obp_requests } from '$lib/obp/requests';

const API_VERSION = 'v6.0.0';
const CURRENT_BANK_FIELD = 'CURRENT_BANK_ID';

export async function load(event: RequestEvent) {
	const productCode = event.params.product_code;
	const token = event.locals.session?.data?.oauth?.access_token;

	if (!productCode) {
		error(400, { message: 'Product code is required' });
	}

	// Prefer the user's current bank if set as a personal data field.
	let preferredBankId: string | null = null;
	if (token) {
		try {
			const prefs = await obp_requests.get(
				`/obp/${API_VERSION}/my/personal-data-fields`,
				token
			);
			const attrs: { name: string; value: string }[] = prefs?.user_attributes || [];
			const attr = attrs.find((a) => a.name === CURRENT_BANK_FIELD);
			if (attr?.value) preferredBankId = attr.value;
		} catch (e) {
			logger.warn('Could not read CURRENT_BANK_ID; falling back to bank scan:', e);
		}
	}

	let bankIds: string[] = [];
	try {
		const banksResponse = await obp_requests.get(`/obp/${API_VERSION}/banks`);
		const rawBanks = banksResponse?.banks || [];
		bankIds = rawBanks.map((b: any) => b.id || b.bank_id).filter(Boolean);
	} catch (e) {
		logger.error('Error fetching banks:', e);
		error(500, { message: 'Could not fetch banks list.' });
	}

	const ordered = preferredBankId
		? [preferredBankId, ...bankIds.filter((id) => id !== preferredBankId)]
		: bankIds;

	let matchedBankId: string | null = null;
	for (const bankId of ordered) {
		try {
			const productsResponse = await obp_requests.get(
				`/obp/${API_VERSION}/banks/${encodeURIComponent(bankId)}/products`,
				token
			);
			const products: OBPProduct[] = productsResponse?.products || [];
			if (products.some((p) => p.product_code === productCode)) {
				matchedBankId = bankId;
				break;
			}
		} catch (e) {
			// continue searching
		}
	}

	if (!matchedBankId) {
		error(404, { message: `Product not found: ${productCode}` });
	}

	logger.info(`Redirecting ${productCode} to canonical URL at bank ${matchedBankId}`);
	redirect(
		307,
		`/financial-products/${encodeURIComponent(matchedBankId)}/${encodeURIComponent(productCode)}`
	);
}
