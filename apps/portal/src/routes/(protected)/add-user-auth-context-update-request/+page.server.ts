import { createLogger } from '$lib/utils/logger';
const logger = createLogger('AddUserAuthContextUpdateRequest');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { redirect, isRedirect } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '$lib/obp/errors';

export async function load(event: RequestEvent) {
	const bankId = event.url.searchParams.get('BANK_ID');
	const scaMethod = event.url.searchParams.get('SCA_METHOD');
	const key = event.url.searchParams.get('key') || 'CUSTOMER_NUMBER';


	if (!bankId || !scaMethod) {
		return {
			loadError: 'Missing required parameters: BANK_ID and SCA_METHOD are required.',
			bankId: bankId || '',
			scaMethod: scaMethod || '',
			key,
			};
	}

	return {
		bankId,
		scaMethod,
		key,
	};
}

export const actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const value = formData.get('value') as string;
		const bankId = formData.get('bankId') as string;
		const scaMethod = formData.get('scaMethod') as string;
		const key = formData.get('key') as string;

		if (!value) {
			return { error: 'Please enter a value.' };
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { error: 'No access token found in session.' };
		}

		try {
			const response = await obp_requests.post(
				`/obp/v5.0.0/banks/${bankId}/users/current/auth-context-updates/${scaMethod}`,
				{ key, value },
				token
			);

			const authContextUpdateId = response.user_auth_context_update_id;
			redirect(
				303,
				`/confirm-user-auth-context-update-request?BANK_ID=${bankId}&AUTH_CONTEXT_UPDATE_ID=${authContextUpdateId}`
			);
		} catch (e) {
			if (isRedirect(e)) throw e;
			logger.error('Error creating auth context update:', e);
			let errorMessage = 'Failed to create auth context update request.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { error: errorMessage };
		}
	}
} satisfies Actions;
