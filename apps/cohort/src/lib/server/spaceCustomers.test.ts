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
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./obp', () => ({ obpRequests: { get: vi.fn() } }));

const { obpRequests } = await import('./obp');
const { organisationCustomers } = await import('./organisationCustomers');
const get = vi.mocked(obpRequests.get);

/** A page of n Customers as OBP-API returns it, with ids starting at `from`. */
const page = (n: number, from = 0) => ({
	customers: Array.from({ length: n }, (_, i) => ({ customer_id: `c-${from + i}` }))
});

// organisationCustomers reads the organisations' Customers from OBP-API v7.0.0, page by page.
describe('organisationCustomers', () => {
	beforeEach(() => get.mockReset());

	it('reads every page of the attribute-filtered Customers, not only the first 50', async () => {
		// Tests that Cohort asks for 200 at a time and keeps reading: OBP-API returns 50 without a limit.
		get
			.mockResolvedValueOnce(page(200))
			.mockResolvedValueOnce(page(3, 200))
			.mockResolvedValueOnce(page(0));
		const customers = await organisationCustomers(
			'cohort',
			'organisation_kind=bank_fi,university',
			'token-1'
		);
		// All three pages are read: 200 + 3 Customers.
		expect(customers).toHaveLength(203);
		// The first request: the attribute filter, limit=200 and offset=0, on v7.0.0.
		expect(get).toHaveBeenNthCalledWith(
			1,
			'/obp/v7.0.0/banks/cohort/customers?organisation_kind=bank_fi,university&limit=200&offset=0',
			'token-1'
		);
		// The next request moves on by the page size: offset=200.
		expect(get).toHaveBeenNthCalledWith(
			2,
			'/obp/v7.0.0/banks/cohort/customers?organisation_kind=bank_fi,university&limit=200&offset=200',
			'token-1'
		);
	});

	it('does not stop at a page OBP-API returned short, only at an empty one', async () => {
		// Tests the end of the list: only an empty page ends it. A page can be shorter than the limit before
		// the end, when a matching attribute belongs to a Customer that no longer exists.
		get
			.mockResolvedValueOnce(page(199))
			.mockResolvedValueOnce(page(50, 200))
			.mockResolvedValueOnce(page(0));
		expect(
			await organisationCustomers('cohort', 'organisation_kind=partner', 'token-1')
		).toHaveLength(249);
		// 199 is short, yet the next page is read; the empty third page ends the reading.
		expect(get).toHaveBeenCalledTimes(3);
	});

	it('stops at an empty page', async () => {
		// Tests a space without organisations: one request, an empty list, no further pages.
		get.mockResolvedValueOnce(page(0));
		expect(await organisationCustomers('cohort', 'organisation_kind=partner', 'token-1')).toEqual(
			[]
		);
		expect(get).toHaveBeenCalledTimes(1);
	});
});
