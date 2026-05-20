import type { RequestEvent, Actions } from '@sveltejs/kit';
import { error, fail, redirect } from '@sveltejs/kit';
import { createLogger } from '@obp/shared/utils';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';

const logger = createLogger('signatory-panels/create/+page.server');

const API_VERSION = 'v6.0.0';

export async function load(event: RequestEvent) {
	const { bank_id, account_id, mandate_id } = event.params;
	const accessToken = event.locals.session?.data?.oauth?.access_token;

	if (!accessToken) {
		error(401, { message: 'Unauthorized: No access token found in session.' });
	}

	if (!bank_id || !account_id || !mandate_id) {
		error(400, { message: 'bank_id, account_id, and mandate_id are required.' });
	}

	return { bank_id, account_id, mandate_id };
}

interface CreateFail {
	panel_name: string;
	description: string;
	user_ids: string[];
	formError: string;
}

function buildFail(formError: string, panel_name = '', description = '', user_ids: string[] = []): CreateFail {
	return { panel_name, description, user_ids, formError };
}

export const actions = {
	default: async ({ request, locals, params }) => {
		const { bank_id, account_id, mandate_id } = params;
		const accessToken = locals.session?.data?.oauth?.access_token;

		if (!accessToken) {
			return fail(401, buildFail('No access token found in session.'));
		}
		if (!bank_id || !account_id || !mandate_id) {
			return fail(400, buildFail('bank_id, account_id, and mandate_id are required.'));
		}

		const form = await request.formData();
		const panel_name = String(form.get('panel_name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const user_ids = form
			.getAll('user_ids')
			.map((v) => String(v).trim())
			.filter(Boolean);

		if (!panel_name) {
			return fail(400, buildFail('Panel name is required.', panel_name, description, user_ids));
		}

		const url = `/obp/${API_VERSION}/banks/${encodeURIComponent(bank_id)}/mandates/${encodeURIComponent(mandate_id)}/signatory-panels`;

		try {
			await obp_requests.post(url, { panel_name, description, user_ids }, accessToken);
		} catch (e) {
			logger.error('Failed to create signatory panel:', e);
			let message = 'Failed to create signatory panel.';
			if (e instanceof OBPRequestError) message = e.message;
			else if (e instanceof Error) message = e.message;
			return fail(500, buildFail(message, panel_name, description, user_ids));
		}

		redirect(
			303,
			`/user/accounts/${encodeURIComponent(bank_id)}/${encodeURIComponent(account_id)}/mandates/${encodeURIComponent(mandate_id)}/signatory-panels`
		);
	}
} satisfies Actions;
