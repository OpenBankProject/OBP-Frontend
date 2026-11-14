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
import { beforeEach, describe, expect, it, vi } from 'vitest';

const put = vi.hoisted(() => vi.fn());
vi.mock('$lib/obp/requests', () => ({ obp_requests: { put } }));
// The session stands in as { accessToken } so a test can log a User in.
vi.mock('$lib/oauth/sessionHelper', () => ({
	SessionOAuthHelper: { getSessionOAuth: (session: any) => session }
}));

import { PUT } from '$lib/../routes/backend/system-views/[view_id]/+server';

function update(viewId: string, body: unknown) {
	return PUT({
		params: { view_id: viewId },
		request: new Request('http://manager/backend/system-views/' + viewId, {
			method: 'PUT',
			body: JSON.stringify(body)
		}),
		locals: { session: { data: { user: { user_id: 'u1' } }, accessToken: 'token' } }
	} as any);
}

describe('updating a system view', () => {
	beforeEach(() => put.mockReset());

	it('calls the OBP-API endpoint that updates a system view', async () => {
		// Tests the path and the body sent to OBP-API. OBP-API updates a system view at
		// PUT /obp/v6.0.0/system-views/VIEW_ID; /management/system-views/VIEW_ID only answers GET.
		put.mockResolvedValue({ view_id: 'owner', description: 'The owner view' });
		const response = await update('owner', {
			name: 'owner',
			description: 'The owner view',
			metadata_view: 'owner',
			is_public: false,
			which_alias_to_use: 'private',
			hide_metadata_if_alias_used: false,
			allowed_actions: ['can_see_transaction_amount']
		});
		expect(response.status).toBe(200);
		expect(put).toHaveBeenCalledTimes(1);
		const [path, body, token] = put.mock.calls[0];
		expect(path).toBe('/obp/v6.0.0/system-views/owner');
		expect(body.description).toBe('The owner view');
		expect(body.allowed_actions).toEqual(['can_see_transaction_amount']);
		expect(token).toBe('token');
	});

	it('refuses an update without a description before calling OBP-API', async () => {
		// Tests that an incomplete form is answered here with 400 and never reaches OBP-API.
		const response = await update('owner', { name: 'owner' });
		expect(response.status).toBe(400);
		expect(put).not.toHaveBeenCalled();
	});
});
