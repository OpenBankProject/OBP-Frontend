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
import { createLogger } from '@obp/shared/utils';
import { requestApplicationAccessToken } from './applicationToken';
import { obpRequests } from './obp';
import { cohortSpace } from './space';

const logger = createLogger('CohortCustomers');

/**
 * An applicant is a Customer of Cohort's space: the legal person behind the login, linked to the User by a User
 * Customer Link. Cohort creates the Customer and the link as itself (its CanCreateCustomer and
 * CanCreateUserCustomerLink Scopes at the space) the first time someone applies; emails to them go to the Customer.
 */
export interface MyCustomer {
	customer_id: string;
	legal_name: string;
	mobile_phone_number: string;
	email: string;
}

const space = () => encodeURIComponent(cohortSpace());

/** The logged-in User's Customer in Cohort's space, or null when they are not one yet. */
export async function myCustomer(token: string): Promise<MyCustomer | null> {
	const response = await obpRequests.get(`/obp/v7.0.0/banks/${space()}/my/customers`, token);
	const found = (response?.customers ?? [])[0];
	return found
		? {
				customer_id: String(found.customer_id ?? ''),
				legal_name: String(found.legal_name ?? ''),
				mobile_phone_number: String(found.mobile_phone_number ?? ''),
				email: String(found.email ?? '')
			}
		: null;
}

/**
 * Makes the User an INDIVIDUAL Customer of Cohort's space (kyc_status false) and links them to it, as Cohort. The
 * caller checks first, with myCustomer, that the User is not one already. Returns the new customer_id.
 */
export async function createCustomerForUser(
	userId: string,
	details: { legal_name: string; mobile_phone_number: string; email: string }
): Promise<string> {
	const { token } = await requestApplicationAccessToken();
	if (!token) throw new Error('Cohort has no application token, so it cannot register applicants.');
	const created = await obpRequests.post(
		`/obp/v6.0.0/banks/${space()}/customers`,
		{ ...details, customer_type: 'INDIVIDUAL', kyc_status: false },
		token
	);
	const customerId = String(created?.customer_id ?? '');
	try {
		await obpRequests.post(`/obp/v4.0.0/banks/${space()}/user_customer_links`, { user_id: userId, customer_id: customerId }, token);
	} catch (err) {
		// The Customer exists but belongs to nobody yet; link it by hand (Create User Customer Link) to reuse it.
		logger.error(`Customer ${customerId} was created but not linked to User ${userId}:`, err);
		throw err;
	}
	return customerId;
}
