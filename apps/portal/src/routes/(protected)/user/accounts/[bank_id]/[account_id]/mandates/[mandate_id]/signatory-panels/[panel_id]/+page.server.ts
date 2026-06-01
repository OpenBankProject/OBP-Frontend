import type { RequestEvent, Actions } from '@sveltejs/kit';
import { error, fail, redirect } from '@sveltejs/kit';
import { createLogger } from '@obp/shared/utils';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';

const logger = createLogger('signatory-panels/[panel_id]/+page.server');

const API_VERSION = 'v6.0.0';

export interface PanelDetail {
	panel_id: string;
	panel_name: string;
	description: string;
	user_ids: string[];
}

function panelUrl(bank_id: string, mandate_id: string, panel_id: string): string {
	return `/obp/${API_VERSION}/banks/${encodeURIComponent(bank_id)}/mandates/${encodeURIComponent(mandate_id)}/signatory-panels/${encodeURIComponent(panel_id)}`;
}

export async function load(event: RequestEvent) {
	const { bank_id, account_id, mandate_id, panel_id } = event.params;
	const accessToken = event.locals.session?.data?.oauth?.access_token;

	if (!accessToken) {
		error(401, { message: 'Unauthorized: No access token found in session.' });
	}

	if (!bank_id || !account_id || !mandate_id || !panel_id) {
		error(400, { message: 'bank_id, account_id, mandate_id, and panel_id are required.' });
	}

	let panel: PanelDetail | null = null;
	let fetchError: string | null = null;

	try {
		const raw = await obp_requests.get(panelUrl(bank_id, mandate_id, panel_id), accessToken);
		panel = {
			panel_id: raw.panel_id,
			panel_name: raw.panel_name,
			description: raw.description ?? '',
			user_ids: raw.user_ids ?? []
		};
	} catch (e) {
		logger.error('Failed to fetch signatory panel:', e);
		fetchError = e instanceof Error ? e.message : String(e);
	}

	return { bank_id, account_id, mandate_id, panel_id, panel, fetchError };
}

export const actions = {
	update: async ({ request, locals, params }) => {
		const { bank_id, mandate_id, panel_id } = params;
		const accessToken = locals.session?.data?.oauth?.access_token;

		if (!accessToken) return fail(401, { formError: 'No access token found in session.' });
		if (!bank_id || !mandate_id || !panel_id) {
			return fail(400, { formError: 'bank_id, mandate_id, and panel_id are required.' });
		}

		const form = await request.formData();
		const panel_name = String(form.get('panel_name') ?? '').trim();
		const description = String(form.get('description') ?? '').trim();
		const user_ids = form
			.getAll('user_ids')
			.map((v) => String(v).trim())
			.filter(Boolean);

		if (!panel_name) {
			return fail(400, { formError: 'Panel name is required.' });
		}

		try {
			await obp_requests.put(
				panelUrl(bank_id, mandate_id, panel_id),
				{ panel_name, description, user_ids },
				accessToken
			);
		} catch (e) {
			logger.error('Failed to update signatory panel:', e);
			let message = 'Failed to update signatory panel.';
			if (e instanceof OBPRequestError) message = e.message;
			else if (e instanceof Error) message = e.message;
			return fail(500, { formError: message });
		}

		return { success: true, message: 'Panel updated.' };
	},

	delete: async ({ locals, params }) => {
		const { bank_id, account_id, mandate_id, panel_id } = params;
		const accessToken = locals.session?.data?.oauth?.access_token;

		if (!accessToken) return fail(401, { formError: 'No access token found in session.' });
		if (!bank_id || !account_id || !mandate_id || !panel_id) {
			return fail(400, { formError: 'Missing route parameters.' });
		}

		try {
			await obp_requests.delete(panelUrl(bank_id, mandate_id, panel_id), accessToken);
		} catch (e) {
			logger.error('Failed to delete signatory panel:', e);
			let message = 'Failed to delete signatory panel.';
			if (e instanceof OBPRequestError) message = e.message;
			else if (e instanceof Error) message = e.message;
			return fail(500, { formError: message });
		}

		redirect(
			303,
			`/user/accounts/${encodeURIComponent(bank_id)}/${encodeURIComponent(account_id)}/mandates/${encodeURIComponent(mandate_id)}/signatory-panels`
		);
	}
} satisfies Actions;
