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
import { obp_requests } from '$lib/obp/requests';
import { OBPRequestError } from '@obp/shared/obp';
import { fail } from '@sveltejs/kit';
import type { Actions } from '@sveltejs/kit';
import type { OBPPersonalDataField } from '$lib/obp/types';

const logger = createLogger('user/personal-data-fields/+page.server');

const VALID_TYPES = ['STRING', 'INTEGER', 'DOUBLE', 'DATE_WITH_DAY'];

export async function load({ locals }) {
    const session = locals.session;
    const accessToken = session?.data?.oauth?.access_token;

    try {
        const response = await obp_requests.get('/obp/v6.0.0/my/personal-data-fields', accessToken);
        const fields: OBPPersonalDataField[] = response.user_attributes || [];
        return { fields };
    } catch (e) {
        logger.error('Error fetching personal data fields:', e);
        let loadError = 'Failed to load personal data fields.';
        if (e instanceof OBPRequestError) {
            loadError = e.message;
        }
        return { fields: [] as OBPPersonalDataField[], loadError };
    }
}

export const actions = {
    create: async ({ request, locals }) => {
        const formData = await request.formData();
        const name = formData.get('name')?.toString().trim();
        const type = formData.get('type')?.toString();
        const value = formData.get('value')?.toString().trim();

        if (!name) {
            return fail(400, { action: 'create', message: 'Name is required.', name, type, value });
        }
        if (!type || !VALID_TYPES.includes(type)) {
            return fail(400, { action: 'create', message: 'A valid type is required.', name, type, value });
        }
        if (value === undefined || value === null || value === '') {
            return fail(400, { action: 'create', message: 'Value is required.', name, type, value });
        }

        const token = locals.session.data.oauth?.access_token;
        if (!token) {
            return fail(401, { action: 'create', message: 'Not authenticated.' });
        }

        try {
            await obp_requests.post('/obp/v6.0.0/my/personal-data-fields', { name, type, value }, token);
            return { success: true, message: 'Personal data field created successfully.' };
        } catch (err) {
            logger.error('Error creating personal data field:', err);
            let errorMessage = 'Failed to create personal data field.';
            if (err instanceof OBPRequestError) {
                errorMessage = err.message;
            }
            return fail(500, { action: 'create', message: errorMessage, name, type, value });
        }
    },

    update: async ({ request, locals }) => {
        const formData = await request.formData();
        const id = formData.get('user_attribute_id')?.toString();
        const name = formData.get('name')?.toString().trim();
        const type = formData.get('type')?.toString();
        const value = formData.get('value')?.toString().trim();

        if (!id) {
            return fail(400, { action: 'update', message: 'Field ID is required.' });
        }
        if (!name) {
            return fail(400, { action: 'update', message: 'Name is required.', editId: id });
        }
        if (!type || !VALID_TYPES.includes(type)) {
            return fail(400, { action: 'update', message: 'A valid type is required.', editId: id });
        }
        if (value === undefined || value === null || value === '') {
            return fail(400, { action: 'update', message: 'Value is required.', editId: id });
        }

        const token = locals.session.data.oauth?.access_token;
        if (!token) {
            return fail(401, { action: 'update', message: 'Not authenticated.' });
        }

        try {
            await obp_requests.put(`/obp/v6.0.0/my/personal-data-fields/${id}`, { name, type, value }, token);
            return { success: true, message: 'Personal data field updated successfully.' };
        } catch (err) {
            logger.error('Error updating personal data field:', err);
            let errorMessage = 'Failed to update personal data field.';
            if (err instanceof OBPRequestError) {
                errorMessage = err.message;
            }
            return fail(500, { action: 'update', message: errorMessage, editId: id });
        }
    },

    delete: async ({ request, locals }) => {
        const formData = await request.formData();
        const id = formData.get('user_attribute_id')?.toString();

        if (!id) {
            return fail(400, { action: 'delete', message: 'Field ID is required.' });
        }

        const token = locals.session.data.oauth?.access_token;
        if (!token) {
            return fail(401, { action: 'delete', message: 'Not authenticated.' });
        }

        try {
            await obp_requests.delete(`/obp/v6.0.0/my/personal-data-fields/${id}`, token);
            return { success: true, message: 'Personal data field deleted successfully.' };
        } catch (err) {
            logger.error('Error deleting personal data field:', err);
            let errorMessage = 'Failed to delete personal data field.';
            if (err instanceof OBPRequestError) {
                errorMessage = err.message;
            }
            return fail(500, { action: 'delete', message: errorMessage });
        }
    }
} satisfies Actions;
