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
import { describe, expect, it } from 'vitest';
import { organisationOfCustomer, organisationsQuery } from './organisations';

describe('organisations as Customers', () => {
	it('reads an organisation from a Customer and its attributes', () => {
		const o = organisationOfCustomer({
			customer_id: 'c-1',
			legal_name: 'Example Bank',
			customer_attributes: [
				{ name: 'organisation_kind', value: 'bank_fi' },
				{ name: 'name_ar', value: 'البنك المثال' },
				{ name: 'website', value: 'https://bank.example.com' }
			]
		});
		expect(o).toEqual({ id: 'c-1', name: 'Example Bank', name_ar: 'البنك المثال', kind: 'bank_fi', customer_id: 'c-1', website: 'https://bank.example.com' });
	});

	it('treats an unknown or missing kind as a partner', () => {
		expect(organisationOfCustomer({ customer_id: 'c-2', legal_name: 'X' }).kind).toBe('partner');
	});

	it('lists every kind staff create, but not startups', () => {
		expect(organisationsQuery()).toBe('organisation_kind=bank_fi&organisation_kind=university&organisation_kind=regulator&organisation_kind=partner');
	});
});
