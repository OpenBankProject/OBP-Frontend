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
import { userToken } from '$lib/server/records';
import { addExampleSuite } from '$lib/server/exampleData';
import { REQUIREMENT, SUITE, TEST } from '$lib/server/entities/definitions';
import { centralSpace } from '$lib/server/space';
import type { Actions, PageServerLoad } from './$types';

/** The Roles adding the example suite uses, all at the central space. */
const ROLES = [
	{ role: `CanCreateDynamicEntityRecord_${REQUIREMENT}`, purpose: 'to add the example requirements' },
	{ role: `CanCreateDynamicEntityRecord_${SUITE}`, purpose: 'to create the example suite' },
	{ role: `CanCreateDynamicEntityRecord_${TEST}`, purpose: 'to add its tests' },
	{ role: `CanUpdateDynamicEntityRecord_${SUITE}`, purpose: 'to approve it, and retire an earlier version' },
	{ role: `CanUpdateDynamicEntityRecord_${REQUIREMENT}`, purpose: 'to correct earlier example requirements' }
];

export const load: PageServerLoad = async () => ({ space: centralSpace(), roles: ROLES });

export const actions: Actions = {
	// The runner reads the example OpenAPI document from this app, at its public address.
	add: async ({ locals, url }) => ({ steps: await addExampleSuite(userToken(locals)!, url.origin) })
};
