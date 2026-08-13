import { createLogger } from '@obp/shared/utils';
const logger = createLogger('PasswordResetServer');
import { type Actions, redirect } from "@sveltejs/kit";
import { obp_requests } from "$lib/obp/requests";
import { getPasswordPolicies } from "$lib/obp/passwordConfig";
import type { OBPPasswordResetRequestBody } from "$lib/obp/types";
import { OBPRequestError, isPasswordAcceptable } from "@obp/shared/obp";
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    const { token } = params;

    logger.debug("Password reset page loaded");

    return {
        token,
        passwordPolicies: await getPasswordPolicies()
    };
};

export const actions = {
    default: async ({ request, params }) => {
        const { token } = params;
        const formData = await request.formData();

        logger.debug("Password reset form submitted");

        const newPassword = formData.get('new_password') as string;
        const confirmPassword = formData.get('confirm_password') as string;

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            return {
                message: 'Passwords do not match',
                success: false
            };
        }

        // Validate against the policy published by the API; if the config is
        // unavailable the API itself still enforces it (OBP-30207).
        const passwordPolicies = await getPasswordPolicies();
        if (!isPasswordAcceptable(newPassword, passwordPolicies)) {
            return {
                message: passwordPolicies!.description,
                success: false
            };
        }

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

            logger.info("Password reset successful");

        } catch (err) {
            if (err instanceof OBPRequestError) {
                logger.error("OBP API error during password reset:", err.message);
                return {
                    message: err.message,
                    success: false
                };
            }

            logger.error("Error resetting password:", err);
            return {
                message: `Failed to reset password: ${err instanceof Error ? err.message : 'Unknown error'}`,
                success: false
            };
        }

        // Redirect to login page with success message
        redirect(303, '/login?reset=success');
    }
} satisfies Actions;
