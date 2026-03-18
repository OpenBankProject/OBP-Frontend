import { createLogger } from '$lib/utils/logger';
const logger = createLogger('UserValidationServer');
import type { ServerLoad } from '@sveltejs/kit';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '$lib/obp/errors';

export const load: ServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');
	
	logger.debug('Email validation token:', token);

	if (!token) {
		logger.warn('No token provided for email validation');
		return {
			success: false,
			error: 'No validation token provided. Please check your email for the validation link.'
		};
	}

	try {
		// Call the OBP API to validate the email
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
				error: error.message,
				errorCode: error.obpErrorCode
			};
		}
		
		logger.error('Error validating email:', error);
		return {
			success: false,
			error: 'Failed to validate email. Please try again or contact support.'
		};
	}
};