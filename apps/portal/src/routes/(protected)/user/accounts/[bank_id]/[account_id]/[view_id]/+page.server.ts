import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { createLogger } from '@obp/shared/utils';
import { OBPRequestError, OBPRateLimitError, OBPTimeoutError } from '@obp/shared/obp';
import { obp_requests } from '$lib/obp/requests';
import type { LoadError, LoadErrorCategory } from './types';

const logger = createLogger('user/accounts/[bank_id]/[account_id]/[view_id]/+page.server');

function toLoadError(e: unknown): LoadError {
	if (e instanceof OBPTimeoutError) {
		return { status: 504, message: e.message, obpCode: null, category: 'timeout' };
	}
	if (e instanceof OBPRateLimitError) {
		return { status: 429, message: e.message, obpCode: null, category: 'rate_limit' };
	}
	if (e instanceof OBPRequestError) {
		const status = Number(e.code) || 500;
		const msg = e.message || '';
		const obpCode = e.obpErrorCode === 'UNKNOWN_ERROR' ? null : e.obpErrorCode;
		let category: LoadErrorCategory = 'other';
		if (status === 401) category = 'unauthorized';
		else if (status === 403 || /missing one or more roles|does not have permission|not have access/i.test(msg))
			category = 'access';
		else if (status === 404 || /not found/i.test(msg)) category = 'not_found';
		return { status, message: msg, obpCode, category };
	}
	const message = e instanceof Error ? e.message : String(e);
	return { status: 500, message, obpCode: null, category: 'other' };
}

export interface AccountDetail {
	id: string;
	bank_id: string;
	label: string;
	account_type: string;
	account_routings: { scheme: string; address: string }[];
	balance?: { currency: string; amount: string };
}

export interface ViewSummary {
	id: string;
	short_name: string;
	description: string;
	is_public: boolean;
	has_access: boolean;
}

export interface TransactionRow {
	id: string;
	posted: string;
	completed: string;
	type: string;
	description: string;
	amount: string;
	currency: string;
	new_balance_amount: string;
	other_holder: string;
	counterparty_id: string | null;
}

export async function load(event: RequestEvent) {
	const { bank_id, account_id, view_id } = event.params;
	const session = event.locals.session;
	const accessToken = session?.data?.oauth?.access_token;

	if (!accessToken) {
		error(401, { message: 'Unauthorized: No access token found in session.' });
	}

	if (!bank_id || !account_id || !view_id) {
		error(400, { message: 'bank_id, account_id, and view_id are required.' });
	}

	const accountUrl = `/obp/v7.0.0/banks/${encodeURIComponent(bank_id)}/accounts/${encodeURIComponent(account_id)}/${encodeURIComponent(view_id)}/account`;
	const transactionsUrl = `/obp/v6.0.0/banks/${encodeURIComponent(bank_id)}/accounts/${encodeURIComponent(account_id)}/${encodeURIComponent(view_id)}/transactions?limit=10&sort_direction=DESC`;
	const viewsUrl = `/obp/v5.0.0/banks/${encodeURIComponent(bank_id)}/accounts/${encodeURIComponent(account_id)}/views`;
	const myAccountsUrl = '/obp/v3.0.0/my/accounts';

	const [accountResult, transactionsResult, viewsResult, myAccountsResult] =
		await Promise.allSettled([
			obp_requests.get(accountUrl, accessToken),
			obp_requests.get(transactionsUrl, accessToken),
			obp_requests.get(viewsUrl, accessToken),
			obp_requests.get(myAccountsUrl, accessToken)
		]);

	let account: AccountDetail | null = null;
	let accountError: LoadError | null = null;

	if (accountResult.status === 'fulfilled') {
		const raw = accountResult.value;
		account = {
			id: raw.id,
			bank_id: raw.bank_id,
			label: raw.label,
			account_type: raw.account_type,
			account_routings: raw.account_routings ?? [],
			balance: raw.balance
		};
	} else {
		accountError = toLoadError(accountResult.reason);
		logger.error('Failed to fetch account detail:', accountResult.reason);
	}

	let transactions: TransactionRow[] = [];
	let transactionsError: LoadError | null = null;

	if (transactionsResult.status === 'fulfilled') {
		const rawTxs = transactionsResult.value.transactions ?? [];
		transactions = rawTxs.map((t: any): TransactionRow => ({
			id: t.id,
			posted: t.details?.posted,
			completed: t.details?.completed,
			type: t.details?.type,
			description: t.details?.description,
			amount: t.details?.value?.amount,
			currency: t.details?.value?.currency,
			new_balance_amount: t.details?.new_balance?.amount,
			other_holder: t.other_account?.holder?.name,
			counterparty_id: t.other_account?.id ?? null
		}));
	} else {
		transactionsError = toLoadError(transactionsResult.reason);
		logger.error('Failed to fetch transactions:', transactionsResult.reason);
	}

	if (account && !account.balance && transactions.length > 0) {
		const newest = transactions[0];
		if (newest.new_balance_amount && newest.currency) {
			account.balance = { amount: newest.new_balance_amount, currency: newest.currency };
		}
	}

	const accessibleViewIds = new Set<string>();
	if (myAccountsResult.status === 'fulfilled') {
		const accounts = myAccountsResult.value.accounts ?? [];
		const matching = accounts.find(
			(a: any) => a.bank_id === bank_id && a.id === account_id
		);
		for (const v of matching?.views ?? []) {
			accessibleViewIds.add(v.id);
		}
	} else {
		logger.error('Failed to fetch /my/accounts for access check:', myAccountsResult.reason);
	}

	let availableViews: ViewSummary[] = [];
	if (viewsResult.status === 'fulfilled') {
		const rawViews = viewsResult.value.views ?? [];
		availableViews = rawViews.map((v: any): ViewSummary => ({
			id: v.id,
			short_name: v.short_name,
			description: v.description,
			is_public: v.is_public,
			has_access: accessibleViewIds.has(v.id)
		}));
	} else {
		logger.error('Failed to fetch views for account:', viewsResult.reason);
		const matching = (myAccountsResult.status === 'fulfilled' ? myAccountsResult.value.accounts ?? [] : []).find(
			(a: any) => a.bank_id === bank_id && a.id === account_id
		);
		for (const v of matching?.views ?? []) {
			availableViews.push({
				id: v.id,
				short_name: v.short_name,
				description: v.description,
				is_public: v.is_public,
				has_access: true
			});
		}
	}

	return {
		bank_id,
		account_id,
		view_id,
		account,
		accountError,
		transactions,
		transactionsError,
		availableViews
	};
}
