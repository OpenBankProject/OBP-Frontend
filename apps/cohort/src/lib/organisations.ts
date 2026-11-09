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

/** The kinds of organisation in the hub's network. Startups are their participants' registered companies. */
export const ORGANISATION_KINDS = ['startup', 'bank_fi', 'university', 'regulator', 'partner'] as const;
export type OrganisationKind = (typeof ORGANISATION_KINDS)[number];

export const isOrganisationKind = (v: unknown): v is OrganisationKind => (ORGANISATION_KINDS as readonly unknown[]).includes(v);

/**
 * An organisation is a CORPORATE Customer of Cohort's space: its name is the Customer's legal_name, and these Customer
 * Attributes hold the rest. Startups' Customers carry none: they are listed from their participation.
 */
export const ORGANISATION_ATTRIBUTES = { kind: 'organisation_kind', name_ar: 'name_ar', website: 'website' } as const;

/** The kinds staff create; a startup's Customer is registered by the startup itself. */
export const CREATABLE_KINDS = ORGANISATION_KINDS.filter((k) => k !== 'startup');

export interface CustomerAttribute {
	name?: unknown;
	value?: unknown;
}

/** An organisation from a Customer with its attributes, as GET /banks/BANK_ID/customers?organisation_kind=… returns it. */
export function organisationOfCustomer(c: { customer_id?: unknown; legal_name?: unknown; customer_attributes?: CustomerAttribute[] }) {
	const attribute = (name: string) => String((c.customer_attributes ?? []).find((a) => a.name === name)?.value ?? '');
	const kind = attribute(ORGANISATION_ATTRIBUTES.kind);
	return {
		id: String(c.customer_id ?? ''),
		name: String(c.legal_name ?? ''),
		name_ar: attribute(ORGANISATION_ATTRIBUTES.name_ar),
		kind: isOrganisationKind(kind) ? kind : ('partner' as OrganisationKind),
		customer_id: String(c.customer_id ?? ''),
		website: attribute(ORGANISATION_ATTRIBUTES.website)
	};
}

/** The query listing the organisations staff created: Customers whose organisation_kind is any creatable kind. */
export const organisationsQuery = () => CREATABLE_KINDS.map((k) => `${ORGANISATION_ATTRIBUTES.kind}=${k}`).join('&');
