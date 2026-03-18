import { createLogger } from '$lib/utils/logger';
const logger = createLogger('RegisterServer');
import { type Actions, redirect } from "@sveltejs/kit";
import { obp_requests } from "$lib/obp/requests";
import type { OBPUserRegistrationRequestBody } from "$lib/obp/types";
import { OBPRequestError } from "$lib/obp/errors";

export const actions = {
    default: async ({ request, locals, cookies }) => {
        const formData = await request.formData()
        
        logger.debug("Form Data:", Object.fromEntries(formData.entries()));

        const formEntries = Object.fromEntries(formData.entries());
        const requestBody: OBPUserRegistrationRequestBody = {
            email: formEntries.email as string,
            username: formEntries.username as string,
            password: formEntries.password as string,
            first_name: formEntries.first_name as string,
            last_name: formEntries.last_name as string
        };

        // Store form data to return on error (excluding password)
        const formDataToReturn = {
            first_name: formEntries.first_name as string,
            last_name: formEntries.last_name as string,
            email: formEntries.email as string,
            username: formEntries.username as string
        };

        // Make request to OBP to register the consumer
        try {
            const response = await obp_requests.post(`/obp/v6.0.0/users`, requestBody);

            
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
                    error: error.message,
                    formData: formDataToReturn
                };
            }
            logger.error("Error registering user:", error);
            return {
                error: `Failed to register user: ${error instanceof Error ? error.message : 'Unknown error'}`,
                formData: formDataToReturn
            };
        }

        return redirect(303, `/register/success`);

    }
} satisfies Actions