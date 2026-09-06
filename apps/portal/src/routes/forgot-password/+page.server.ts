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
const logger = createLogger('ForgotPasswordServer');
import { type Actions, fail } from "@sveltejs/kit";
import { obp_requests } from "$lib/obp/requests";
import type { OBPPasswordResetInitiateRequestBody } from "$lib/obp/types";
import { OBPRequestError } from "@obp/shared/obp";
import { rateLimitMessage } from "@obp/shared/server/rate-limit";

export const actions = {
    default: async ({ request, locals }) => {
        // Flagged by the rate-limit hook: refuse before any API call.
        if (locals.rateLimit) {
            return fail(429, { message: rateLimitMessage(locals.rateLimit), success: false });
        }

        const formData = await request.formData();
        const username = formData.get('username') as string;
        const email = formData.get('email') as string;

        logger.debug("Password reset requested for username:", username, "email:", email);

        // Validate username
        if (!username || username.trim().length === 0) {
            return {
                message: 'Please enter your username',
                success: false
            };
        }

        // Validate email format
        if (!email || !email.includes('@')) {
            return {
                message: 'Please enter a valid email address',
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