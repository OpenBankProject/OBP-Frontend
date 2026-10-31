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
import { obpRequests } from './obp';
import { cohortSpace } from './space';
import { apiManagerUrl } from './appDirectory';
import { APPLICATION, CALL, PROGRAMME, SCREENING_DECISION } from './entities/definitions';

/** A Role staff need at Cohort's space, and the i18n key saying what it is for. */
export interface StaffRole {
	role_name: string;
	purpose: string;
}

/** The Roles Cohort's staff pages use. Add a line here when a staff page starts needing a new one. */
export const STAFF_ROLES: StaffRole[] = [
	{ role_name: `CanCreateDynamicEntityRecord_${PROGRAMME}`, purpose: 'access_purpose_create_programme' },
	{ role_name: `CanUpdateDynamicEntityRecord_${PROGRAMME}`, purpose: 'access_purpose_update_programme' },
	{ role_name: `CanCreateDynamicEntityRecord_${CALL}`, purpose: 'access_purpose_create_call' },
	{ role_name: `CanUpdateDynamicEntityRecord_${CALL}`, purpose: 'access_purpose_update_call' },
	{ role_name: `CanGetDynamicEntityRecord_${APPLICATION}`, purpose: 'access_purpose_read_applications' },
	{ role_name: `CanCreateDynamicEntityRecord_${SCREENING_DECISION}`, purpose: 'access_purpose_decide' },
	{ role_name: `CanGetDynamicEntityRecord_${SCREENING_DECISION}`, purpose: 'access_purpose_read_decisions' },
	{ role_name: 'CanGetFileAtOneBank', purpose: 'access_purpose_read_files' },
	{ role_name: 'CanUpdateFileScanStatusAtOneBank', purpose: 'access_purpose_scan_files' }
];

export function isStaffRole(roleName: string): boolean {
	return STAFF_ROLES.some((r) => r.role_name === roleName);
}

interface Grant {
	role_name: string;
	bank_id: string;
}

/**
 * Each staff Role at the space: held, requested (an entitlement request is waiting), or neither. Reads the
 * User's Roles from OBP rather than the session, so a Role granted since login shows at once.
 */
export async function staffAccess(token: string) {
	const space = cohortSpace();
	const [user, requests, manager] = await Promise.all([
		obpRequests.get('/obp/v5.1.0/users/current', token),
		obpRequests.get('/obp/v3.0.0/my/entitlement-requests', token).catch(() => ({ entitlement_requests: [] })),
		apiManagerUrl()
	]);
	const held: Grant[] = user?.entitlements?.list ?? [];
	const requested: Grant[] = requests?.entitlement_requests ?? [];
	const at = (list: Grant[], role: string) => list.some((g) => g.role_name === role && g.bank_id === space);
	return {
		user,
		space,
		roles: STAFF_ROLES.map((r) => ({
			...r,
			held: at(held, r.role_name),
			requested: at(requested, r.role_name)
		})),
		entitlementRequestsUrl: manager ? `${manager}/rbac/entitlement-requests` : null
	};
}

/** Ask for a staff Role at the space; an administrator accepts it in the API Manager. */
export async function requestStaffRole(roleName: string, token: string): Promise<void> {
	await obpRequests.post('/obp/v6.0.0/entitlement-requests', { bank_id: cohortSpace(), role_name: roleName }, token);
}
