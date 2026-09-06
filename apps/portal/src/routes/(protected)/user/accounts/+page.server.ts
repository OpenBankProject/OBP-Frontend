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
import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { createLogger } from '@obp/shared/utils';
import { obp_requests } from '$lib/obp/requests';

const logger = createLogger('user/accounts/+page.server');

export interface AccountRouting {
	scheme: string;
	address: string;
}

export interface AccountView {
	id: string;
	short_name: string;
	description: string;
	is_public: boolean;
}

export interface AccountListItem {
	id: string;
	bank_id: string;
	label: string;
	account_type: string;
	account_routings: AccountRouting[];
	views: AccountView[];
}

export interface BankSummary {
	id: string;
	full_name: string;
}

export async function load(event: RequestEvent) {
	const session = event.locals.session;
	const accessToken = session?.data?.oauth?.access_token;

	if (!accessToken) {
		error(401, { message: 'Unauthorized: No access token found in session.' });
	}

	let accounts: AccountListItem[] = [];
	let banks: Record<string, BankSummary> = {};
	let fetchError: string | null = null;

	try {
		const accountsResponse = await obp_requests.get('/obp/v3.0.0/my/accounts', accessToken);
		accounts = accountsResponse.accounts ?? [];
	} catch (e) {
		logger.error('Failed to fetch user accounts:', e);
		fetchError = e instanceof Error ? e.message : String(e);
	}

	try {
		const banksResponse = await obp_requests.get('/obp/v5.1.0/banks', accessToken);
		for (const bank of banksResponse.banks ?? []) {
			banks[bank.id] = { id: bank.id, full_name: bank.full_name };
		}
	} catch (e) {
		logger.error('Failed to fetch banks list:', e);
	}

	return {
		accounts,
		banks,
		fetchError
	};
}
