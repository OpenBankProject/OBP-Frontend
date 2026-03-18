import { createLogger } from '$lib/utils/logger';
const logger = createLogger('UserInvitationServer');
import { type Actions, redirect, error } from "@sveltejs/kit";
import { obp_requests } from "$lib/obp/requests";
import { OBPRequestError } from "$lib/obp/errors";
import type { PageServerLoad } from './$types';
import type { OBPUserInvitation, OBPUserInvitationValidateRequestBody, OBPUserInvitationAcceptRequestBody } from "$lib/obp/types";
import { env } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

export const load: PageServerLoad = async ({ url }) => {
    logger.debug("Full URL:", url.href);
    logger.debug("Search params:", url.searchParams.toString());
    logger.debug("All params:", Array.from(url.searchParams.entries()));
    
    const secretKey = url.searchParams.get('id');
    
    logger.debug("Extracted secret key:", secretKey, "Type:", typeof secretKey);
    
    if (!secretKey) {
        logger.error("No secret key provided in URL. Full URL:", url.href);
        throw error(400, {
            message: 'Invalid invitation link. Missing invitation ID.'
        });
    }

    logger.debug("User invitation page loaded with secret key:", secretKey);
    
    return {
        secretKey,
        apiBaseUrl: env.PUBLIC_OBP_BASE_URL
    };
};

export const actions = {
    validate: async ({ request }) => {
        const formData = await request.formData();
        const secretKey = formData.get('secret_key') as string;
        const bankId = formData.get('bank_id') as string;

        if (!secretKey) {
            return {
                error: 'Invalid invitation link',
                success: false
            };
        }

        // Use bank_id from form, environment variable, or default
        // Priority: form > env > default
        const effectiveBankId = bankId || 
                                privateEnv.DEFAULT_BANK_ID || 
                                env.PUBLIC_DEFAULT_BANK_ID || 
                                'gh.29.uk';

        logger.debug("Validating invitation with secret key:", secretKey, "and bank_id:", effectiveBankId);

        try {
            // Call OBP API to validate the invitation
            // POST /obp/v4.0.0/banks/{BANK_ID}/user-invitations
            const requestBody: OBPUserInvitationValidateRequestBody = {
                secret_key: parseInt(secretKey)
            };

            const response = await obp_requests.post(
                `/obp/v4.0.0/banks/${effectiveBankId}/user-invitations`,
                requestBody
            ) as OBPUserInvitation;

            logger.info("Invitation validated successfully:", response);

            return {
                success: true,
                invitation: {
                    first_name: response.first_name,
                    last_name: response.last_name,
                    email: response.email,
                    company: response.company,
                    country: response.country,
                    purpose: response.purpose,
                    status: response.status
                }
            };

        } catch (err) {
            if (err instanceof OBPRequestError) {
                logger.error("OBP API error during invitation validation:", err.message);
                
                // Check for specific error codes
                if (err.code === 'OBP-37883') {
                    return {
                        error: 'This invitation is invalid, has expired, or has already been used.',
                        success: false
                    };
                }
                
                return {
                    error: err.message,
                    success: false
                };
            }

            logger.error("Error validating invitation:", err);
            return {
                error: `Failed to validate invitation: ${err instanceof Error ? err.message : 'Unknown error'}`,
                success: false
            };
        }
    },

    accept: async ({ request }) => {
        const formData = await request.formData();
        const secretKey = formData.get('secret_key') as string;
        const username = formData.get('username') as string;
        const password = formData.get('password') as string;
        const confirmPassword = formData.get('confirm_password') as string;
        const firstName = formData.get('first_name') as string;
        const lastName = formData.get('last_name') as string;
        const email = formData.get('email') as string;
        const company = formData.get('company') as string;
        const country = formData.get('country') as string;
        const privacyPolicy = formData.get('privacy_policy') as string;
        const termsConditions = formData.get('terms_conditions') as string;
        const personalData = formData.get('personal_data') as string;
        const marketing = formData.get('marketing') as string;
        const bankId = formData.get('bank_id') as string;

        logger.debug("User invitation acceptance submitted (Option B - Full Portal Flow)");

        // Validate required fields
        if (!secretKey) {
            return {
                error: 'Invalid invitation link',
                success: false
            };
        }

        if (!username || username.trim().length === 0) {
            return {
                error: 'Username is required',
                success: false
            };
        }

        if (!password || password.length < 8) {
            return {
                error: 'Password must be at least 8 characters long',
                success: false
            };
        }

        if (password !== confirmPassword) {
            return {
                error: 'Passwords do not match',
                success: false
            };
        }

        // Validate required checkboxes
        if (privacyPolicy !== 'on') {
            return {
                error: 'You must accept the Privacy Policy',
                success: false
            };
        }

        if (termsConditions !== 'on') {
            return {
                error: 'You must accept the Terms and Conditions',
                success: false
            };
        }

        if (personalData !== 'on') {
            return {
                error: 'You must consent to personal data collection',
                success: false
            };
        }

        // Use bank_id from form, environment variable, or default
        const effectiveBankId = bankId || 
                                privateEnv.DEFAULT_BANK_ID || 
                                env.PUBLIC_DEFAULT_BANK_ID || 
                                'gh.29.uk';

        logger.info("Form validation passed, creating user account via REST API");

        try {
            // Option B: Create user account directly via REST API
            // PUT /obp/v4.0.0/banks/{BANK_ID}/user-invitation
            const requestBody: OBPUserInvitationAcceptRequestBody = {
                secret_key: parseInt(secretKey),
                username: username.trim(),
                password: password,
                first_name: firstName,
                last_name: lastName,
                email: email,
                company: company,
                country: country
            };

            logger.debug("Calling OBP-API to accept invitation and create user:", {
                bank_id: effectiveBankId,
                username: username,
                email: email
            });

            const response = await obp_requests.put(
                `/obp/v4.0.0/banks/${effectiveBankId}/user-invitation`,
                requestBody
            );

            logger.info("User account created successfully via invitation acceptance:", response);

            // Redirect to login page with success message
            throw redirect(303, '/login?invitation_accepted=true');

        } catch (err) {
            if (err instanceof OBPRequestError) {
                logger.error("OBP API error during invitation acceptance:", err.message, err.code);
                
                // Check for specific error codes
                if (err.code === 'OBP-37883') {
                    return {
                        error: 'This invitation is invalid, has expired, or has already been used.',
                        success: false
                    };
                }
                
                if (err.code === 'OBP-20001') {
                    return {
                        error: 'Username already exists. Please choose a different username.',
                        success: false
                    };
                }

                if (err.code === 'OBP-20002') {
                    return {
                        error: 'Email address is already registered.',
                        success: false
                    };
                }

                if (err.code === 'OBP-10202') {
                    return {
                        error: 'Password does not meet security requirements. Please use a stronger password.',
                        success: false
                    };
                }
                
                return {
                    error: `Failed to create account: ${err.message}`,
                    success: false
                };
            }

            logger.error("Unexpected error during invitation acceptance:", err);
            return {
                error: `Failed to create account: ${err instanceof Error ? err.message : 'Unknown error'}`,
                success: false
            };
        }
    }
} satisfies Actions;