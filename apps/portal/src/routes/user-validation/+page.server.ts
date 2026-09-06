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
const logger = createLogger('UserValidationServer');
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';

// The validation token is single-use, so it must only be consumed by an explicit
// POST (see the `validate` action below) — never as a side effect of the GET load,
// which link scanners and `data-sveltekit-preload-data` prefetches would trigger.
export const load: ServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');

	if (!token) {
		logger.warn('No token provided for email validation');
	}

	return { token };
};

export const actions: Actions = {
	validate: async ({ request }) => {
		const formData = await request.formData();
		const token = formData.get('token') as string | null;

		logger.debug('Email validation requested');

		if (!token) {
			logger.warn('No token provided for email validation');
			return {
				success: false,
				message: 'No validation token provided. Please check your email for the validation link.'
			};
		}

		try {
			const response = await obp_requests.post(`/obp/v6.0.0/users/email-validation`, {
				token: token
			});

			logger.info('Email validation successful:', response);

			return {
				success: true,
				message: 'Email successfully validated!',
				data: response
			};
		} catch (error) {
			if (error instanceof OBPRequestError) {
				logger.error('OBP error during email validation:', error.obpErrorCode, error.message);
				return {
					success: false,
					message: error.message,
					errorCode: error.obpErrorCode
				};
			}

			logger.error('Error validating email:', error);
			return {
				success: false,
				message: 'Failed to validate email. Please try again or contact support.'
			};
		}
	}
};
