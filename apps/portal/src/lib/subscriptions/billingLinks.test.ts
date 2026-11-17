import { describe, it, expect } from 'vitest';
import { stripeCheckoutUrl, stripeManageBillingUrl } from './billingLinks';

describe('stripeCheckoutUrl', () => {
	it('adds the checkout path and the subscription ID to the base URL', () => {
		expect(stripeCheckoutUrl('https://stripe.example.com', 'sub-123')).toBe(
			'https://stripe.example.com/checkout?api_product_subscription_id=sub-123'
		);
	});

	it('does not double a trailing slash on the base URL', () => {
		expect(stripeCheckoutUrl('https://stripe.example.com/', 'sub-123')).toBe(
			'https://stripe.example.com/checkout?api_product_subscription_id=sub-123'
		);
	});

	it('encodes the subscription ID', () => {
		expect(stripeCheckoutUrl('https://stripe.example.com', 'a b&c')).toBe(
			'https://stripe.example.com/checkout?api_product_subscription_id=a%20b%26c'
		);
	});

	it('returns null when the base URL is not set', () => {
		expect(stripeCheckoutUrl(undefined, 'sub-123')).toBeNull();
		expect(stripeCheckoutUrl('  ', 'sub-123')).toBeNull();
	});
});

describe('stripeManageBillingUrl', () => {
	it('links to the home page of the billing service', () => {
		expect(stripeManageBillingUrl('https://stripe.example.com')).toBe('https://stripe.example.com/');
		expect(stripeManageBillingUrl('https://stripe.example.com/')).toBe('https://stripe.example.com/');
	});

	it('returns null when the base URL is not set', () => {
		expect(stripeManageBillingUrl('')).toBeNull();
	});
});
