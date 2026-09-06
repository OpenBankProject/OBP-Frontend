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
const logger = createLogger('ConsumerRegisterServer');
import { type Actions, fail, redirect } from "@sveltejs/kit";
import { obp_requests } from "$lib/obp/requests";
import type { OBPConsumerRequestBody } from "$lib/obp/types";
import { OBPRequestError } from '@obp/shared/obp';
import { rateLimitMessage } from "@obp/shared/server/rate-limit";

export const actions = {
    default: async ({ request, locals, cookies }) => {
        // Flagged by the rate-limit hook: refuse before any API call.
        if (locals.rateLimit) {
            return fail(429, { message: rateLimitMessage(locals.rateLimit) });
        }

        const formData = await request.formData()
        
        logger.debug("Form Data:", Object.fromEntries(formData.entries()));

        // 
        const formEntries = Object.fromEntries(formData.entries());
        const requestBody: OBPConsumerRequestBody = {
            app_type: formEntries.app_type as 'public' | 'confidential',
            app_name: formEntries.app_name as string,
            redirect_url: formEntries.redirect_url as string,
            developer_email: formEntries.developer_email as string,
            description: formEntries.description as string,
            company: formEntries.company as string,
            ...(formEntries.client_certificate ? { client_certificate: formEntries.client_certificate as string } : {}),
            enabled: true
        };

        // Get the access token from the session
        

        const token = locals.session.data.oauth?.access_token;
        if (!token) {
            return {
                message: "No access token found in session."
            };
        }
        // Make request to OBP to register the consumer
        try {
            const response = await obp_requests.post(`/obp/v5.1.0/my/consumers`, requestBody, token);

            
            logger.info("Consumer created successfully:", response);

            // Store the response data in a secure cookie for the success page
            // Flash Message, will be deleted when the user visits the success page
            cookies.set('consumer_data', JSON.stringify(response), {
                path: '/',
                maxAge: 60, // 1 minute - short lived
                httpOnly: true,
                secure: true,
                sameSite: 'strict'
            });
            
        } catch (error) {
            logger.error("Error registering consumer:", error);
            let errorMessage = "Failed to create consumer";
            if (error instanceof OBPRequestError) {
                errorMessage = error.message;
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            return {
                message: errorMessage
            };
        }



        return redirect(303, `/consumers/register/success`);

    }
} satisfies Actions