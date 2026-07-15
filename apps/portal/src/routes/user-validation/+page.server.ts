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
