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
import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { OBP_ENTITY_SPACE_ID: 'cohort' } }));
vi.mock('./appDirectory', () => ({ apiManagerUrl: async () => 'http://localhost:3003' }));
const get = vi.fn();
vi.mock('./obp', () => ({ obpRequests: { get: (path: string) => get(path) } }));

const { staffAccess, isStaffRole } = await import('./staffAccess');

describe('staffAccess', () => {
	it('marks each Role held or requested at the space only', async () => {
		get.mockImplementation(async (path: string) =>
			path.includes('users/current')
				? { user_id: 'u1', entitlements: { list: [
						{ role_name: 'CanCreateDynamicEntityRecord_cohort_programme', bank_id: 'cohort' },
						{ role_name: 'CanCreateDynamicEntityRecord_cohort_call', bank_id: 'another-bank' }
					] } }
				: { entitlement_requests: [{ role_name: 'CanGetDynamicEntityRecord_cohort_application', bank_id: 'cohort' }] }
		);
		const access = await staffAccess('token');
		const byName = Object.fromEntries(access.roles.map((r) => [r.role_name, r]));
		expect(byName.CanCreateDynamicEntityRecord_cohort_programme.held).toBe(true);
		expect(byName.CanCreateDynamicEntityRecord_cohort_call.held).toBe(false);
		expect(byName.CanGetDynamicEntityRecord_cohort_application.requested).toBe(true);
		expect(access.entitlementRequestsUrl).toBe('http://localhost:3003/rbac/entitlement-requests');
	});

	it('only knows the staff Roles', () => {
		expect(isStaffRole('CanCreateDynamicEntityRecord_cohort_call')).toBe(true);
		expect(isStaffRole('CanCreateBank')).toBe(false);
	});
});
