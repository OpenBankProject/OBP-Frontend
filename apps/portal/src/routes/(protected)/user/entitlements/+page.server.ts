import { type SessionData } from 'svelte-kit-sessions';
import { createLogger } from '$lib/utils/logger';
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '$lib/obp/errors';
import { fail } from '@sveltejs/kit';

const logger = createLogger('user/entitlements/+page.server');

export async function load({ locals }) {
    const session = locals.session;
    const accessToken = session?.data?.oauth?.access_token;

    async function getUserEntitlements() {
        try {
            const response = await obp_requests.get('/obp/v5.1.0/my/entitlements', accessToken);
            return response.list || [];
        } catch (e) {
            logger.error('Error fetching user entitlements:', e);
            return [];
        }
    }

    async function getAllAvalilableEntitlements(): Promise<Array<{ role: string, requires_bank_id: boolean }>> {
        try {
            const allEntitlements = await obp_requests.get('/obp/v5.1.0/roles', accessToken);
            return allEntitlements.roles;
        } catch (e) {
            logger.error('Error fetching all available entitlements:', e);
            return [];
        }
    }

    async function getAllBanks(): Promise<Array<{ bank_id: string, name: string }>> {
        let banks = [];
        try {
            const banksResponse = await obp_requests.get('/obp/v5.1.0/banks');
            for (const bank of banksResponse.banks) {
                banks.push({
                    bank_id: bank.id,
                    name: bank.full_name
                });
            }
            return banks;
        } catch (e) {
            logger.error('Error fetching banks:', e);
            return [];
        }
    }

    const allBanks = await getAllBanks();
    const allAvailableEntitlements = await getAllAvalilableEntitlements();
    const userEntitlements = await getUserEntitlements();

    return {
        allAvailableEntitlements,
        userEntitlements,
        allBanks
    }
}

import { type Actions, redirect } from "@sveltejs/kit";
import type { OBPAddEntitlementBody } from "$lib/obp/types";

// Action to handle entitlement creation form submission
export const actions = {
    create: async ({ request, locals, cookies }) => {
        const formData = await request.formData()
        logger.debug("Form Data:", Object.fromEntries(formData.entries()));

        const formEntries = Object.fromEntries(formData.entries());
        const entitlement = formEntries.entitlement;
        const bank_id = formEntries.bank_id;
        if (!entitlement) {
            return fail(400, { entitlement: entitlement, missing: true});
        }

        const requestBody: OBPAddEntitlementBody = {
            ...(formEntries.bank_id && { bank_id: String(formEntries.bank_id) }),
            role_name: formEntries.entitlement as string,
        };

        const token = locals.session.data.oauth?.access_token;
        const currentUserId = locals.session.data.user?.user_id
        if (!token || !currentUserId) {
            return {
                error: "No access token or user_id not found in session."
            };
        }
        // Make request to OBP to add the entitlement
        try {
            const response = await obp_requests.post(`/obp/v5.1.0/users/${currentUserId}/entitlements`, requestBody, token);
            logger.info("Entitlement added successfully:", response);

            // Fetch updated entitlements from the API to refresh the session
            try {
                const updatedEntitlements = await obp_requests.get('/obp/v5.1.0/my/entitlements', token);
                // Update the session with the new entitlements
                if (updatedEntitlements && locals.session.data.user) {
                    locals.session.data.user.entitlements = updatedEntitlements;
                    await locals.session.save();
                }
            } catch (refreshError) {
                logger.error("Error refreshing entitlements:", refreshError);
                // Don't fail the request, the entitlement was added successfully
            }

            // Return success to trigger a page reload
            return { success: true, message: 'Entitlement added successfully' };

        } catch (err) {
            logger.error("Error adding entitlement:", err);
            let errorMessage = 'Failed to add entitlement.';
            if (err instanceof OBPRequestError) {
                errorMessage = err.message;
            } else if (err instanceof Error) {
                errorMessage = err.message;
            }
            return fail(500, {entitlement: entitlement, error: errorMessage, ...(bank_id ? { bank_id: bank_id } : {})});
        }
    }
} satisfies Actions