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
const logger = createLogger('PasswordResetServer');
import { type Actions, fail, redirect } from "@sveltejs/kit";
import { obp_requests } from "$lib/obp/requests";
import { getPasswordPolicies } from "$lib/obp/passwordConfig";
import type { OBPPasswordResetRequestBody } from "$lib/obp/types";
import { OBPRequestError, isPasswordAcceptable } from "@obp/shared/obp";
import { rateLimitMessage } from "@obp/shared/server/rate-limit";
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
    default: async ({ request, params, locals }) => {
        // Flagged by the rate-limit hook: refuse before any API call.
        if (locals.rateLimit) {
            return fail(429, { message: rateLimitMessage(locals.rateLimit), success: false });
        }

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
