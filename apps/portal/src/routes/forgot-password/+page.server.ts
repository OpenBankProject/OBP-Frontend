import { createLogger } from '$lib/utils/logger';
const logger = createLogger('ForgotPasswordServer');
import { type Actions } from "@sveltejs/kit";
import { obp_requests } from "$lib/obp/requests";
import type { OBPPasswordResetInitiateRequestBody } from "$lib/obp/types";
import { OBPRequestError } from "$lib/obp/errors";

export const actions = {
    default: async ({ request }) => {
        const formData = await request.formData();
        const username = formData.get('username') as string;
        const email = formData.get('email') as string;

        logger.debug("Password reset requested for username:", username, "email:", email);

        // Validate username
        if (!username || username.trim().length === 0) {
            return {
                error: 'Please enter your username',
                success: false
            };
        }

        // Validate email format
        if (!email || !email.includes('@')) {
            return {
                error: 'Please enter a valid email address',
                success: false
            };
        }

        // Build request body for OBP API
        const requestBody: OBPPasswordResetInitiateRequestBody = {
            username: username,
            email: email
        };

        try {
            // Call OBP API to initiate password reset
            const response = await obp_requests.post(
                `/obp/v6.0.0/users/password-reset-url`,
                requestBody
            );

            logger.info("Password reset email sent for:", email);

            return {
                success: true,
                email: email,
                apiStatus: 'ok' as const,
                apiMessage: 'OBP-API responded successfully.'
            };

        } catch (error) {
            // Log the actual error for debugging
            let apiMessage = 'OBP-API is not responding.';
            if (error instanceof OBPRequestError) {
                logger.error("OBP API error during password reset request:", error.message);
                apiMessage = `OBP-API error: ${error.message}`;
            } else if (error instanceof Error) {
                logger.error("Error requesting password reset:", error);
                apiMessage = `OBP-API error: ${error.message}`;
            }

            // Still return success to user to prevent email enumeration
            // This is a security best practice - don't reveal if email exists
            return {
                success: true,
                email: email,
                apiStatus: 'error' as const,
                apiMessage
            };
        }
    }
} satisfies Actions;