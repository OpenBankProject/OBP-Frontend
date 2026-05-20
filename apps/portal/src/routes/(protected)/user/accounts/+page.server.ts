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
