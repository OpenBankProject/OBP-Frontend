import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { createLogger } from '@obp/shared/utils';
import { obp_requests } from '$lib/obp/requests';

const logger = createLogger(
	'user/accounts/[bank_id]/[account_id]/[view_id]/counterparties/[counterparty_id]/+page.server'
);

export interface CounterpartyDetail {
	counterparty_id: string;
	name?: string;
	description?: string;
	currency?: string;
	created_by_user_id?: string;
	this_bank_id?: string;
	this_account_id?: string;
	this_view_id?: string;
	other_bank_routing_scheme?: string;
	other_bank_routing_address?: string;
	other_branch_routing_scheme?: string;
	other_branch_routing_address?: string;
	other_account_routing_scheme?: string;
	other_account_routing_address?: string;
	other_account_secondary_routing_scheme?: string;
	other_account_secondary_routing_address?: string;
	is_beneficiary?: boolean;
	bespoke?: { key: string; value: string }[];
	metadata?: {
		public_alias?: string;
		private_alias?: string;
		more_info?: string;
		url?: string;
		image_url?: string;
		open_corporates_url?: string;
		corporate_location?: { latitude: number; longitude: number };
		physical_location?: { latitude: number; longitude: number };
	};
}

export async function load(event: RequestEvent) {
	const { bank_id, account_id, view_id, counterparty_id } = event.params;
	const accessToken = event.locals.session?.data?.oauth?.access_token;

	if (!accessToken) {
		error(401, { message: 'Unauthorized: No access token found in session.' });
	}

	if (!bank_id || !account_id || !view_id || !counterparty_id) {
		error(400, {
			message: 'bank_id, account_id, view_id, and counterparty_id are required.'
		});
	}

	const url = `/obp/v4.0.0/banks/${encodeURIComponent(bank_id)}/accounts/${encodeURIComponent(
		account_id
	)}/${encodeURIComponent(view_id)}/counterparties/${encodeURIComponent(counterparty_id)}`;

	let counterparty: CounterpartyDetail | null = null;
	let fetchError: string | null = null;

	try {
		const raw = await obp_requests.get(url, accessToken);
		counterparty = raw as CounterpartyDetail;
	} catch (e) {
		fetchError = e instanceof Error ? e.message : String(e);
		logger.error('Failed to fetch counterparty:', e);
	}

	return {
		bank_id,
		account_id,
		view_id,
		counterparty_id,
		counterparty,
		fetchError
	};
}
