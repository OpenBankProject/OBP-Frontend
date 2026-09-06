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
import { type SessionData } from 'svelte-kit-sessions';
import { createLogger } from '@obp/shared/utils';
import { obp_requests } from '$lib/obp/requests';
import { fail } from '@sveltejs/kit';

const logger = createLogger('user/entitlements/+page.server');

export async function load({ locals }) {
    const session = locals.session;
    const accessToken = session?.data?.oauth?.access_token;

    async function getUserEntitlements() {
        try {
            const response = await obp_requests.get('/obp/v6.0.0/my/entitlements', accessToken);
            return response.list || [];
        } catch (e) {
            logger.error('Error fetching user entitlements:', e);
            return [];
        }
    }

    async function getAllAvalilableEntitlements(): Promise<Array<{ role: string, requires_bank_id: boolean }>> {
        try {
            const allEntitlements = await obp_requests.get('/obp/v6.0.0/roles', accessToken);
            return allEntitlements.roles;
        } catch (e) {
            logger.error('Error fetching all available entitlements:', e);
            return [];
        }
    }

    async function getAllBanks(): Promise<Array<{ bank_id: string, name: string }>> {
        let banks = [];
        try {
            const banksResponse = await obp_requests.get('/obp/v6.0.0/banks');
            for (const bank of banksResponse.banks) {
                banks.push({
                    bank_id: bank.bank_id,
                    name: bank.full_name
                });
            }
            return banks;
        } catch (e) {
            logger.error('Error fetching banks:', e);
            return [];
        }
    }

    async function getConsumerScopes(): Promise<{ consumer_id: string; app_name: string; scopes: Array<{ scope_id: string; role_name: string; bank_id: string }> } | null> {
        try {
            const consumer = await obp_requests.get('/obp/v6.0.0/consumers/current', accessToken);
            if (!consumer?.consumer_id) return null;
            const scopesResponse = await obp_requests.get(`/obp/v4.0.0/consumers/${consumer.consumer_id}/scopes`, accessToken);
            return {
                consumer_id: consumer.consumer_id,
                app_name: consumer.app_name || '',
                scopes: scopesResponse?.list || [],
            };
        } catch (e) {
            logger.error('Error fetching consumer scopes:', e);
            return null;
        }
    }

    const allBanks = await getAllBanks();
    const allAvailableEntitlements = await getAllAvalilableEntitlements();
    const userEntitlements = await getUserEntitlements();
    const consumerScopes = await getConsumerScopes();

    return {
        allAvailableEntitlements,
        userEntitlements,
        allBanks,
        consumerScopes,
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
            bank_id: formEntries.bank_id ? String(formEntries.bank_id) : "",
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
            const response = await obp_requests.post(`/obp/v6.0.0/users/${currentUserId}/entitlements`, requestBody, token);
            logger.info("Entitlement added successfully:", response);

            // Fetch updated entitlements from the API to refresh the session
            try {
                const updatedEntitlements = await obp_requests.get('/obp/v6.0.0/my/entitlements', token);
                // Update the session with the new entitlements
                if (updatedEntitlements && locals.session.data.user) {
                    (locals.session.data.user as any).entitlements = updatedEntitlements;
                    await locals.session.save();
                }
            } catch (refreshError) {
                logger.error("Error refreshing entitlements:", refreshError);
                // Don't fail the request, the entitlement was added successfully
            }

            // Return success to trigger a page reload
            return { success: true, message: 'Entitlement added successfully' };

        } catch (error) {
            logger.error("Error adding entitlement:", error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to add entitlement.';
            return fail(500, {entitlement: entitlement, error: errorMessage, ...(bank_id ? { bank_id: bank_id } : {})});
        }
    }
} satisfies Actions