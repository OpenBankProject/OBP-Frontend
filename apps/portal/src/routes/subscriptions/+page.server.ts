import { createLogger } from '@obp/shared/utils';
const logger = createLogger('SubscriptionsServer');

import type { RequestEvent, Actions } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { env as publicEnv } from '$env/dynamic/public';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError, OBPRateLimitError, OBPTimeoutError } from '@obp/shared/obp';
import type {
	OBPConsumer,
	OBPApiProductSubscription,
	OBPPostApiProductSubscription,
	OBPProductAttribute
} from '$lib/obp/types';

// API Products are v6.0.0; the subscription endpoints that extend them are v7.0.0.
const PRODUCTS_API_VERSION = 'v6.0.0';
const SUBSCRIPTIONS_API_VERSION = 'v7.0.0';

/** Which button the product's attributes call for (see OBP-API API_PRODUCT_SUBSCRIPTION_PLAN.md, Phase 4). */
export type SubscribeAction = 'subscribe' | 'request' | 'contact';

export interface SubscribableProduct {
	bank_id: string;
	api_product_code: string;
	name: string;
	category?: string;
	description?: string;
	price_monthly?: number;
	price_currency?: string;
	/** Product attribute SELF_SUBSCRIBE; absent means true. */
	self_subscribe: boolean;
	/** Product attribute BILLING_SYSTEM, lower-cased; absent means "none". */
	billing_system: string;
	action: SubscribeAction;
	/** True when attributes could not be loaded, so self_subscribe / billing_system are defaults. */
	attributes_unknown: boolean;
}

interface ExternalServiceStatus {
	subscriptionsUrl: string;
	status: 'available' | 'error' | 'unavailable' | 'not_configured';
	statusMessage: string;
}

function attributeValue(attributes: OBPProductAttribute[], name: string): string | undefined {
	const hit = attributes.find(
		(a) => a.name?.toLowerCase() === name.toLowerCase() && a.is_active !== false
	);
	return hit?.value?.trim().toLowerCase();
}

function decideAction(selfSubscribe: boolean, billingSystem: string): SubscribeAction {
	if (!selfSubscribe) return 'contact';
	// none / absent: active at once. stripe: OBP-Stripe activates when paid.
	if (billingSystem === 'none' || billingSystem === 'stripe') return 'subscribe';
	// manual / invoice_ninja / anything else: a bank admin or the billing adapter approves.
	return 'request';
}

function toSubscribableProduct(raw: any, attributes: OBPProductAttribute[] | null): SubscribableProduct {
	const attrs = attributes ?? [];
	const selfSubscribe = attributeValue(attrs, 'SELF_SUBSCRIBE') !== 'false';
	const billingSystem = attributeValue(attrs, 'BILLING_SYSTEM') || 'none';
	const amount = raw.monthly_subscription_amount ? parseFloat(raw.monthly_subscription_amount) : undefined;
	return {
		bank_id: raw.bank_id,
		api_product_code: raw.api_product_code,
		name: raw.name || raw.api_product_code,
		category: raw.category || undefined,
		description: raw.description || undefined,
		price_monthly: Number.isFinite(amount) ? amount : undefined,
		price_currency: raw.monthly_subscription_currency || undefined,
		self_subscribe: selfSubscribe,
		billing_system: billingSystem,
		action: decideAction(selfSubscribe, billingSystem),
		attributes_unknown: attributes === null
	};
}

function describeError(e: unknown, fallback: string): string {
	if (e instanceof OBPRateLimitError) return 'API rate limit exceeded. Please wait a moment and try again.';
	if (e instanceof OBPTimeoutError) return 'OBP-API did not respond in time.';
	if (e instanceof OBPRequestError) return e.message;
	if (e instanceof Error) return e.message;
	return fallback;
}

/**
 * The list endpoint omits attributes, and SELF_SUBSCRIBE / BILLING_SYSTEM decide the button,
 * so each product's detail is fetched (in parallel). A failed detail leaves the defaults and
 * marks the product so the UI can say so.
 */
async function loadSubscribableProducts(token: string, warnings: string[]): Promise<SubscribableProduct[]> {
	let rawProducts: any[] = [];
	try {
		const response = await obp_requests.get(`/obp/${PRODUCTS_API_VERSION}/api-products`, token);
		rawProducts = response?.api_products || [];
	} catch (e) {
		logger.error('Error fetching api products:', e);
		warnings.push(`Could not load API products: ${describeError(e, 'unknown error')}`);
		return [];
	}

	const products = await Promise.all(
		rawProducts.map(async (raw) => {
			try {
				const detail = await obp_requests.get(
					`/obp/${PRODUCTS_API_VERSION}/banks/${encodeURIComponent(raw.bank_id)}/api-products/${encodeURIComponent(raw.api_product_code)}`,
					token
				);
				return toSubscribableProduct(detail ?? raw, detail?.attributes ?? []);
			} catch (e) {
				logger.warn(`Could not load attributes for ${raw.bank_id}/${raw.api_product_code}:`, e);
				return toSubscribableProduct(raw, null);
			}
		})
	);

	// Free first, then by price, then by name.
	products.sort((a, b) => {
		const priceDiff = (a.price_monthly ?? 0) - (b.price_monthly ?? 0);
		return priceDiff !== 0 ? priceDiff : a.name.localeCompare(b.name);
	});
	return products;
}

async function loadMyConsumers(token: string, warnings: string[]): Promise<OBPConsumer[]> {
	try {
		const response = await obp_requests.get(
			`/obp/${PRODUCTS_API_VERSION}/management/users/current/consumers`,
			token
		);
		const consumers: OBPConsumer[] = response?.consumers || [];
		consumers.sort((a, b) => (b.created ? Date.parse(b.created) : 0) - (a.created ? Date.parse(a.created) : 0));
		return consumers;
	} catch (e) {
		logger.error('Error fetching consumers:', e);
		warnings.push(`Could not load your consumers: ${describeError(e, 'unknown error')}`);
		return [];
	}
}

async function loadMySubscriptions(token: string, warnings: string[]): Promise<OBPApiProductSubscription[]> {
	try {
		const response = await obp_requests.get(
			`/obp/${SUBSCRIPTIONS_API_VERSION}/my/api-product-subscriptions`,
			token
		);
		const subscriptions: OBPApiProductSubscription[] = response?.api_product_subscriptions || [];
		subscriptions.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
		return subscriptions;
	} catch (e) {
		logger.error('Error fetching my api product subscriptions:', e);
		warnings.push(`Could not load your subscriptions: ${describeError(e, 'unknown error')}`);
		return [];
	}
}

/** The optional external subscriptions service (PUBLIC_SUBSCRIPTIONS_URL), kept from the original page. */
async function checkExternalService(): Promise<ExternalServiceStatus> {
	const subscriptionsUrl = publicEnv.PUBLIC_SUBSCRIPTIONS_URL || '';
	if (!subscriptionsUrl) {
		return {
			subscriptionsUrl: '',
			status: 'not_configured',
			statusMessage: 'The subscriptions service URL is not configured.'
		};
	}
	try {
		const response = await fetch(subscriptionsUrl, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
		if (response.ok) {
			logger.info(`Subscriptions service is available at ${subscriptionsUrl} (HTTP ${response.status})`);
			return { subscriptionsUrl, status: 'available', statusMessage: 'The subscriptions service is available.' };
		}
		logger.warn(`Subscriptions service returned HTTP ${response.status} at ${subscriptionsUrl}`);
		return {
			subscriptionsUrl,
			status: 'error',
			statusMessage: `The subscriptions service returned HTTP ${response.status}.`
		};
	} catch (e) {
		const errorMsg = e instanceof Error ? e.message : String(e);
		logger.error(`Subscriptions service is not reachable at ${subscriptionsUrl}:`, e);
		return {
			subscriptionsUrl,
			status: 'unavailable',
			statusMessage: `The subscriptions service is not reachable: ${errorMsg}`
		};
	}
}

export async function load(event: RequestEvent) {
	const token = event.locals.session?.data?.oauth?.access_token;
	const isLoggedIn = !!token;

	// Pre-selection, e.g. from a product page: /subscriptions?api_product_code=X&bank_id=Y
	const preselect = {
		api_product_code: event.url.searchParams.get('api_product_code') || '',
		bank_id: event.url.searchParams.get('bank_id') || '',
		consumer_id: event.url.searchParams.get('consumer_id') || ''
	};

	const warnings: string[] = [];
	const externalPromise = checkExternalService();

	if (!token) {
		return {
			isLoggedIn,
			preselect,
			warnings,
			products: [] as SubscribableProduct[],
			consumers: [] as OBPConsumer[],
			subscriptions: [] as OBPApiProductSubscription[],
			external: await externalPromise
		};
	}

	const [products, consumers, subscriptions, external] = await Promise.all([
		loadSubscribableProducts(token, warnings),
		loadMyConsumers(token, warnings),
		loadMySubscriptions(token, warnings),
		externalPromise
	]);

	return { isLoggedIn, preselect, warnings, products, consumers, subscriptions, external };
}

/**
 * "2026-09-02" from a date input becomes the OBP JSON date at midnight UTC; empty stays undefined.
 * OBP parses `yyyy-MM-dd'T'HH:mm:ss'Z'` here; a value with milliseconds (Date.toISOString) is
 * silently dropped and start_date falls back to "now" (verified against v7.0.0 on 2026-09-02).
 */
function toObpDate(value: FormDataEntryValue | null): string | undefined {
	const text = typeof value === 'string' ? value.trim() : '';
	if (!text) return undefined;
	const date = new Date(text.length === 10 ? `${text}T00:00:00Z` : text);
	if (Number.isNaN(date.getTime())) return undefined;
	return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export const actions = {
	subscribe: async ({ request, locals }) => {
		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return fail(401, { action: 'subscribe', message: 'Please sign in to subscribe.' });
		}

		const data = await request.formData();
		const bankId = String(data.get('bank_id') || '').trim();
		const apiProductCode = String(data.get('api_product_code') || '').trim();
		const consumerId = String(data.get('consumer_id') || '').trim();
		const startDate = toObpDate(data.get('start_date'));
		const endDate = toObpDate(data.get('end_date'));

		if (!bankId || !apiProductCode) {
			return fail(400, { action: 'subscribe', message: 'Please choose an API product.' });
		}
		if (!consumerId) {
			return fail(400, { action: 'subscribe', message: 'Please choose the consumer (application) to subscribe.' });
		}
		if (data.get('start_date') && !startDate) {
			return fail(400, { action: 'subscribe', message: 'The start date is not a valid date.' });
		}
		if (data.get('end_date') && !endDate) {
			return fail(400, { action: 'subscribe', message: 'The end date is not a valid date.' });
		}
		if (startDate && endDate && endDate < startDate) {
			return fail(400, { action: 'subscribe', message: 'The end date must be after the start date.' });
		}

		const body: OBPPostApiProductSubscription = { consumer_id: consumerId };
		if (startDate) body.start_date = startDate;
		if (endDate) body.end_date = endDate;

		try {
			const subscription: OBPApiProductSubscription = await obp_requests.post(
				`/obp/${SUBSCRIPTIONS_API_VERSION}/banks/${encodeURIComponent(bankId)}/api-products/${encodeURIComponent(apiProductCode)}/subscriptions`,
				body,
				token
			);
			logger.info(
				`Created api product subscription ${subscription?.api_product_subscription_id} (${subscription?.status}) for consumer ${consumerId} to ${bankId}/${apiProductCode}`
			);
			const message =
				subscription?.status === 'active'
					? `Subscription to ${apiProductCode} is active.`
					: `Subscription to ${apiProductCode} has been requested and is awaiting approval or payment.`;
			return { action: 'subscribe', success: true, message, subscription };
		} catch (e) {
			logger.error('Error creating api product subscription:', e);
			return fail(400, {
				action: 'subscribe',
				message: describeError(e, 'Could not create the subscription.')
			});
		}
	},

	cancel: async ({ request, locals }) => {
		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return fail(401, { action: 'cancel', message: 'Please sign in to cancel a subscription.' });
		}

		const data = await request.formData();
		const subscriptionId = String(data.get('api_product_subscription_id') || '').trim();
		if (!subscriptionId) {
			return fail(400, { action: 'cancel', message: 'Subscription ID is required.' });
		}

		try {
			const subscription: OBPApiProductSubscription = await obp_requests.put(
				`/obp/${SUBSCRIPTIONS_API_VERSION}/my/api-product-subscriptions/${encodeURIComponent(subscriptionId)}/status`,
				{ status: 'cancelled' },
				token
			);
			logger.info(`Cancelled api product subscription ${subscriptionId}`);
			return {
				action: 'cancel',
				success: true,
				message: `Subscription to ${subscription?.api_product_code || subscriptionId} has been cancelled.`,
				subscription
			};
		} catch (e) {
			logger.error('Error cancelling api product subscription:', e);
			return fail(400, {
				action: 'cancel',
				message: describeError(e, 'Could not cancel the subscription.')
			});
		}
	}
} satisfies Actions;
