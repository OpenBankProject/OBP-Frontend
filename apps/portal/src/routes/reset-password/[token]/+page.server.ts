import { createLogger } from '$lib/utils/logger';
const logger = createLogger('PasswordResetServer');
import { type Actions, redirect } from "@sveltejs/kit";
import { obp_requests } from "$lib/obp/requests";
import type { OBPPasswordResetRequestBody } from "$lib/obp/types";
import { OBPRequestError } from "$lib/obp/errors";
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    const { token } = params;

    logger.debug("Password reset page loaded with token:", token);

    return {
        token
    };
};

export const actions = {
    default: async ({ request, params }) => {
        const { token } = params;
        const formData = await request.formData();

        logger.debug("Password reset form submitted for token:", token);

        const newPassword = formData.get('new_password') as string;
        const confirmPassword = formData.get('confirm_password') as string;

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            return {
                error: 'Passwords do not match',
                success: false
            };
        }

        // Validate password policy (two-tier rule)
        if (newPassword.length < 10) {
            return {
                error: 'Password must be at least 10 characters long',
                success: false
            };
        }

        if (newPassword.length > 512) {
            return {
                error: 'Password must be at most 512 characters long',
                success: false
            };
        }

        // For passwords under 17 characters, require complexity
        if (newPassword.length < 17) {
            const hasUpperCase = /[A-Z]/.test(newPassword);
            const hasLowerCase = /[a-z]/.test(newPassword);
            const hasNumbers = /\d/.test(newPassword);
            const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);

            if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChars) {
                return {
                    error: 'Password must contain uppercase, lowercase, number, and special character',
                    success: false
                };
            }
        }
        // Passwords 17+ characters only need to meet length requirements (already checked above)

        // Build request body for OBP API
        const requestBody: OBPPasswordResetRequestBody = {
            token: token!,
            new_password: newPassword
        };

        try {
            const response = await obp_requests.post(
                `/obp/v6.0.0/users/password`,
                requestBody
            );

            logger.info("Password reset successful for token:", token);

        } catch (err) {
            if (err instanceof OBPRequestError) {
                logger.error("OBP API error during password reset:", err.message);
                return {
                    error: err.message,
                    success: false
                };
            }

            logger.error("Error resetting password:", err);
            return {
                error: `Failed to reset password: ${err instanceof Error ? err.message : 'Unknown error'}`,
                success: false
            };
        }

        // Redirect to login page with success message
        redirect(303, '/login?reset=success');
    }
} satisfies Actions;
