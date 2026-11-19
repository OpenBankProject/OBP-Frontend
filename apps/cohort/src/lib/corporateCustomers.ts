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

/**
 * The kinds of customer in the hub's network: the legal entities Cohort works with. Startups are their participants'
 * registered companies. They are called customers, never organisations, so they are not confused with OBP-API's
 * Organisations, which Cohort uses for startup teams (see teams.ts).
 */
export const CUSTOMER_KINDS = ['startup', 'bank_fi', 'university', 'regulator', 'partner'] as const;
export type CustomerKind = (typeof CUSTOMER_KINDS)[number];

export const isCustomerKind = (v: unknown): v is CustomerKind => (CUSTOMER_KINDS as readonly unknown[]).includes(v);

/**
 * A customer in the network is a CORPORATE Customer of Cohort's space: its name is the Customer's legal_name, and these Customer
 * Attributes hold the rest. Startups' Customers carry none: they are listed from their participation.
 */
export const CUSTOMER_ATTRIBUTES = { kind: 'customer_kind', name_ar: 'name_ar', website: 'website' } as const;

/** The kinds staff create; a startup's Customer is registered by the startup itself. */
export const CREATABLE_KINDS = CUSTOMER_KINDS.filter((k) => k !== 'startup');

export interface CustomerAttribute {
	name?: unknown;
	value?: unknown;
}

/** A corporate customer from a Customer with its attributes, as GET /banks/BANK_ID/customers?customer_kind=… returns it. */
export function corporateCustomerOf(c: { customer_id?: unknown; legal_name?: unknown; customer_attributes?: CustomerAttribute[] }) {
	const attribute = (name: string) => String((c.customer_attributes ?? []).find((a) => a.name === name)?.value ?? '');
	const kind = attribute(CUSTOMER_ATTRIBUTES.kind);
	return {
		id: String(c.customer_id ?? ''),
		name: String(c.legal_name ?? ''),
		name_ar: attribute(CUSTOMER_ATTRIBUTES.name_ar),
		kind: isCustomerKind(kind) ? kind : ('partner' as CustomerKind),
		customer_id: String(c.customer_id ?? ''),
		website: attribute(CUSTOMER_ATTRIBUTES.website)
	};
}

type CustomerWithAttributes = Parameters<typeof corporateCustomerOf>[0];

/**
 * The corporate customers OBP-API returns for corporateCustomersQuery(). OBP-API filters the Customers by their
 * customer_kind attribute, so Cohort shows each of them as it is.
 */
export function corporateCustomersFrom(customers: CustomerWithAttributes[]) {
	return customers.map(corporateCustomerOf);
}

/**
 * The query listing the corporate customers staff created: Customers whose customer_kind is any creatable kind.
 * One parameter with comma-separated values, as GET /obp/v7.0.0/banks/BANK_ID/customers takes them.
 */
export const corporateCustomersQuery = () => `${CUSTOMER_ATTRIBUTES.kind}=${CREATABLE_KINDS.map(encodeURIComponent).join(',')}`;
