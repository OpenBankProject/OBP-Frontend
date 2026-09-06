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
import { createLogger } from '@obp/shared/utils';
const logger = createLogger('ConfirmUserAuthContextUpdateRequest');
import type { RequestEvent, Actions } from '@sveltejs/kit';
import { redirect, isRedirect } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';

export async function load(event: RequestEvent) {
	const bankId = event.url.searchParams.get('BANK_ID');
	const authContextUpdateId = event.url.searchParams.get('AUTH_CONTEXT_UPDATE_ID');


	if (!bankId || !authContextUpdateId) {
		return {
			loadError: 'Missing required parameters: BANK_ID and AUTH_CONTEXT_UPDATE_ID are required.',
			bankId: bankId || '',
			authContextUpdateId: authContextUpdateId || '',
			};
	}

	return {
		bankId,
		authContextUpdateId,
	};
}

export const actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();
		const answer = formData.get('answer') as string;
		const bankId = formData.get('bankId') as string;
		const authContextUpdateId = formData.get('authContextUpdateId') as string;

		if (!answer) {
			return { message: 'Please enter the OTP code.' };
		}

		const token = locals.session.data.oauth?.access_token;
		if (!token) {
			return { message: 'No access token found in session.' };
		}

		try {
			const response = await obp_requests.post(
				`/obp/v5.0.0/banks/${bankId}/users/current/auth-context-updates/${authContextUpdateId}/challenge`,
				{ answer },
				token
			);

			if (response.status === 'ACCEPTED') {
				redirect(303, '/');
			}

			return {
				success: true,
				message: `Verification status: ${response.status}`
			};
		} catch (e) {
			if (isRedirect(e)) throw e;
			logger.error('Error confirming auth context update:', e);
			let errorMessage = 'Failed to confirm auth context update.';
			if (e instanceof OBPRequestError) {
				errorMessage = e.message;
			}
			return { message: errorMessage };
		}
	}
} satisfies Actions;
