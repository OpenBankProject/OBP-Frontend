/*
 * Copyright (C) 2026 TESOBE GmbH
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
import { fail } from '@sveltejs/kit';
import { runnerCentralScopes } from '@obp/shared/conformator';
import { setupStatus } from '$lib/server/setupStatus';
import { entitlementRequestsUrl, grantRoleUrl, platformAppsUrl } from '$lib/server/appDirectory';
import { isStaffRole, requestStaffRole, staffAccess } from '$lib/server/staffAccess';
import { centralSpace, runnerConsumerId } from '$lib/server/space';
import { reportSigner } from '$lib/server/reports';
import { messageOf } from '$lib/server/errors';
import { userToken } from '$lib/server/records';
import type { Actions, PageServerLoad } from './$types';

/**
 * Everything an administrator needs to make Conformator work, on one page that needs a login but no Role: the
 * API Manager's address, the central space, the app's and the runner's Platform App Scopes, the report signing key, the
 * dynamic entities, and the logged-in User's own staff Roles. Every missing piece links to the API Manager page that
 * fixes it.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const token = userToken(locals)!;
	const username = locals.session.data.user?.username ?? '';
	const [status, access] = await Promise.all([setupStatus(), staffAccess(token)]);
	const manager = status.apiManagerUrl;
	const runner = runnerConsumerId();
	const { signer, problem: signingProblem } = reportSigner();
	return {
		...status,
		username,
		runner: {
			consumerId: runner || null,
			scopes: runnerCentralScopes(centralSpace()),
			platformAppsUrl: manager && runner ? platformAppsUrl(manager, runner, 'OBP-Conformator-Runner') : null
		},
		signing: { ready: signer !== null, keyId: signer?.keyId ?? null, problem: signingProblem },
		roles: access.roles.map((r) => ({
			...r,
			grantUrl: manager && !r.held ? grantRoleUrl(manager, username, r.role_name, r.bank_id) : null
		})),
		entitlementRequestsUrl: manager ? entitlementRequestsUrl(manager) : null
	};
};

export const actions: Actions = {
	/** Ask for a staff Role, for an administrator to accept in the API Manager. */
	request: async ({ locals, request }) => {
		const roleName = String((await request.formData()).get('role_name') ?? '');
		if (!isStaffRole(roleName)) return fail(400, { error: `${roleName} is not a staff Role.` });
		try {
			await requestStaffRole(roleName, userToken(locals)!);
		} catch (err) {
			return fail(400, { error: messageOf(err) });
		}
		return { requested: roleName };
	}
};
