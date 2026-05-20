import type { RequestEvent } from '@sveltejs/kit';
import { error, redirect } from '@sveltejs/kit';
import { createLogger } from '@obp/shared/utils';
import { obp_requests } from '$lib/obp/requests';

const logger = createLogger('user/accounts/[bank_id]/[account_id]/+page.server');

function pickDefaultView(views: { id: string; is_public: boolean }[]): string | null {
	if (!views || views.length === 0) return null;
	const owner = views.find((v) => v.id === 'owner');
	if (owner) return owner.id;
	const privateView = views.find((v) => !v.is_public);
	if (privateView) return privateView.id;
	return views[0].id;
}

export async function load(event: RequestEvent) {
	const { bank_id, account_id } = event.params;
	const session = event.locals.session;
	const accessToken = session?.data?.oauth?.access_token;

	if (!accessToken) {
		error(401, { message: 'Unauthorized: No access token found in session.' });
	}

	if (!bank_id || !account_id) {
		error(400, { message: 'bank_id and account_id are required.' });
	}

	const viewsUrl = `/obp/v5.0.0/banks/${encodeURIComponent(bank_id)}/accounts/${encodeURIComponent(account_id)}/views`;

	let defaultView: string | null = null;
	try {
		const response = await obp_requests.get(viewsUrl, accessToken);
		defaultView = pickDefaultView(response.views ?? []);
	} catch (e) {
		logger.error('Failed to fetch views to choose default:', e);
		error(404, { message: 'Could not resolve a default view for this account.' });
	}

	if (!defaultView) {
		error(404, { message: 'No views available on this account.' });
	}

	redirect(307, `/user/accounts/${encodeURIComponent(bank_id)}/${encodeURIComponent(account_id)}/${encodeURIComponent(defaultView)}`);
}
