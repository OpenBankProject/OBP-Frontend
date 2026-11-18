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

/*
 * Links to OBP-Stripe, the billing service for products whose BILLING_SYSTEM is "stripe".
 * PUBLIC_SUBSCRIPTIONS_URL is the base URL of OBP-Stripe. The user signs in there with the same
 * OBP login, confirms and pays in Stripe, and OBP-Stripe then makes the subscription active.
 */

/** The base URL without a trailing slash, or an empty string when the setting is empty. */
function normaliseBaseUrl(billingServiceUrl: string | undefined): string {
	return (billingServiceUrl ?? '').trim().replace(/\/+$/, '');
}

/**
 * The OBP-Stripe page where the user pays for one subscription that is still "requested".
 * Returns null when PUBLIC_SUBSCRIPTIONS_URL is not set.
 */
export function stripeCheckoutUrl(billingServiceUrl: string | undefined, subscriptionId: string): string | null {
	const baseUrl = normaliseBaseUrl(billingServiceUrl);
	if (!baseUrl) return null;
	return `${baseUrl}/checkout?api_product_subscription_id=${encodeURIComponent(subscriptionId)}`;
}

/**
 * The OBP-Stripe home page. It has the button to the Stripe customer portal, where the user
 * changes the card or sees invoices. Returns null when PUBLIC_SUBSCRIPTIONS_URL is not set.
 */
export function stripeManageBillingUrl(billingServiceUrl: string | undefined): string | null {
	const baseUrl = normaliseBaseUrl(billingServiceUrl);
	if (!baseUrl) return null;
	return `${baseUrl}/`;
}
