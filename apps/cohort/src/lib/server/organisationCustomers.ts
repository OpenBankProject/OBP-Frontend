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
import type { organisationOfCustomer } from '$lib/organisations';
import { obpRequests } from '$lib/server/obp';

type CustomerWithAttributes = Parameters<typeof organisationOfCustomer>[0];

const PAGE_SIZE = 200;
const MAX_PAGES = 50;

/**
 * Every Customer of the space matching the attribute query, from
 * GET /obp/v7.0.0/banks/BANK_ID/customers. The endpoint pages its results (50 by default),
 * so pages are read until one is not full.
 */
export async function organisationCustomers(
	space: string,
	attributeQuery: string,
	token: string
): Promise<CustomerWithAttributes[]> {
	const all: CustomerWithAttributes[] = [];
	for (let page = 0; page < MAX_PAGES; page++) {
		const response = await obpRequests.get(
			`/obp/v7.0.0/banks/${space}/customers?${attributeQuery}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
			token
		);
		const customers: CustomerWithAttributes[] = response?.customers ?? [];
		all.push(...customers);
		if (customers.length < PAGE_SIZE) break;
	}
	return all;
}
