import type { RequestEvent } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { createLogger } from '@obp/shared/utils';
import { obp_requests } from '$lib/obp/requests';

const logger = createLogger('user/accounts/[bank_id]/[account_id]/mandates/+page.server');

const API_VERSION = 'v6.0.0';

export interface MandateRow {
	mandate_id: string;
	mandate_name: string;
	mandate_reference: string;
	status: string;
	valid_from: string;
	valid_to: string;
	description: string;
}

export async function load(event: RequestEvent) {
	const { bank_id, account_id } = event.params;
	const accessToken = event.locals.session?.data?.oauth?.access_token;

	if (!accessToken) {
		error(401, { message: 'Unauthorized: No access token found in session.' });
	}

	if (!bank_id || !account_id) {
		error(400, { message: 'bank_id and account_id are required.' });
	}

	const url = `/obp/${API_VERSION}/banks/${encodeURIComponent(bank_id)}/accounts/${encodeURIComponent(account_id)}/mandates`;

	let mandates: MandateRow[] = [];
	let fetchError: string | null = null;

	try {
		const response = await obp_requests.get(url, accessToken);
		const raw = response.mandates ?? [];
		mandates = raw.map((m: any): MandateRow => ({
			mandate_id: m.mandate_id,
			mandate_name: m.mandate_name,
			mandate_reference: m.mandate_reference,
			status: m.status,
			valid_from: m.valid_from,
			valid_to: m.valid_to,
			description: m.description
		}));
	} catch (e) {
		logger.error('Failed to fetch mandates:', e);
		fetchError = e instanceof Error ? e.message : String(e);
	}

	return { bank_id, account_id, mandates, fetchError };
}
