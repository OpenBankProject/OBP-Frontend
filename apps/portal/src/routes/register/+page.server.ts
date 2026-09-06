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
const logger = createLogger('RegisterServer');
import { type Actions, fail, redirect } from "@sveltejs/kit";
import { obp_requests } from "$lib/obp/requests";
import { getPasswordPolicies } from "$lib/obp/passwordConfig";
import type { OBPUserRegistrationRequestBody } from "$lib/obp/types";
import { OBPRequestError, isMobilePhoneNumberValid } from "@obp/shared/obp";
import { rateLimitMessage } from "@obp/shared/server/rate-limit";
import type { PageServerLoad } from './$types';

// v7.0.0 is the first version whose Create User accepts mobile_phone_number
const REGISTER_USER_ENDPOINT = '/obp/v7.0.0/users';

export const load: PageServerLoad = async () => {
    return {
        passwordPolicies: await getPasswordPolicies()
    };
};

export const actions = {
    default: async ({ request, locals, cookies }) => {
        const formData = await request.formData()
        
        logger.debug("Form Data:", Object.fromEntries(formData.entries()));

        const formEntries = Object.fromEntries(formData.entries());
        const mobilePhoneNumber = ((formEntries.mobile_phone_number as string) || '').trim();
        const requestBody: OBPUserRegistrationRequestBody = {
            email: formEntries.email as string,
            username: formEntries.username as string,
            password: formEntries.password as string,
            first_name: formEntries.first_name as string,
            last_name: formEntries.last_name as string,
            // Optional: only sent when the user typed one
            ...(mobilePhoneNumber ? { mobile_phone_number: mobilePhoneNumber } : {})
        };

        // Store form data to return on error (excluding password)
        const formDataToReturn = {
            first_name: formEntries.first_name as string,
            last_name: formEntries.last_name as string,
            email: formEntries.email as string,
            username: formEntries.username as string,
            mobile_phone_number: mobilePhoneNumber
        };

        // Flagged by the rate-limit hook: refuse before any API call, but keep
        // the typed fields so the user can resubmit later without retyping.
        if (locals.rateLimit) {
            return fail(429, {
                message: rateLimitMessage(locals.rateLimit),
                formData: formDataToReturn
            });
        }

        // Validate username length before hitting the API
        if (requestBody.username.length < 8) {
            return {
                message: 'Username must be at least 8 characters long.',
                formData: formDataToReturn
            };
        }

        // Mirror OBP's InvalidPhoneNumber check so the user gets a clear message
        if (mobilePhoneNumber && !isMobilePhoneNumberValid(mobilePhoneNumber)) {
            return {
                message: 'Mobile phone number must be 5-50 characters: digits, spaces, dashes, dots, parentheses and an optional leading +.',
                formData: formDataToReturn
            };
        }

        // Make request to OBP to register the consumer
        try {
            const response = await obp_requests.post(REGISTER_USER_ENDPOINT, requestBody);

            
            logger.info("User registered successfully:", response);

            // Store the response data in a secure cookie for the success page
            // Flash Message, will be deleted when the user visits the success page
            cookies.set('user', JSON.stringify(response), {
                path: '/',
                maxAge: 60, // 1 minute - short lived
                httpOnly: true,
                secure: true,
                sameSite: 'strict'
            });
            
        } catch (error) {
            if (error instanceof OBPRequestError) {
                // Return the OBP error message directly - it already contains the error code and description
                return {
                    message: error.message,
                    formData: formDataToReturn
                };
            }
            logger.error("Error registering user:", error);
            return {
                message: `Failed to register user: ${error instanceof Error ? error.message : 'Unknown error'}`,
                formData: formDataToReturn
            };
        }

        return redirect(303, `/register/success`);

    }
} satisfies Actions