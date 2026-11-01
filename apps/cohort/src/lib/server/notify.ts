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
import { env } from '$env/dynamic/private';
import { createLogger } from '@obp/shared/utils';
import type { Email } from '$lib/emails';
import { requestApplicationAccessToken } from './applicationToken';
import { messageOf } from './errors';
import { obpRequests } from './obp';
import { cohortSpace } from './space';

const logger = createLogger('CohortNotify');

/**
 * Emails one of the space's Customers through OBP-API's Send Email to Customer, as Cohort itself (the
 * CanSendEmailToCustomerAtOneBank Scope at the space). OBP-API reads the address from the Customer and its message
 * outbox sends the email. Never throws: an email that cannot be queued is logged, and what the User did still counts.
 */
export async function emailCustomer(customerId: string, email: Email, reference: string): Promise<boolean> {
	if (!customerId) {
		logger.warn(`No Customer for ${reference}; email not sent.`);
		return false;
	}
	try {
		const { token } = await requestApplicationAccessToken();
		if (!token) {
			logger.warn('No application token; email not sent.');
			return false;
		}
		await obpRequests.post(
			`/obp/v7.0.0/banks/${encodeURIComponent(cohortSpace())}/customers/${encodeURIComponent(customerId)}/emails`,
			{ subject: email.subject, text: email.text, reference },
			token
		);
		return true;
	} catch (err) {
		logger.warn(`Email to Customer ${customerId} (${reference}) not sent: ${messageOf(err)}`);
		return false;
	}
}

/** The absolute URL of a Cohort page, for links in emails. */
export function pageUrl(path: string): string {
	return `${(env.ORIGIN ?? '').replace(/\/+$/, '')}${path}`;
}
