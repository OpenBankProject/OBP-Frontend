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
import type { PageServerLoad } from './$types';
import { setupStatus } from '$lib/server/setupStatus';

/**
 * The setup page: the Platform App side of Cohort's setup, which an administrator does in the API Manager before
 * anyone holds a staff Role. Needs a login but no Role; shows only what Cohort's Scopes check already knows.
 */
export const load: PageServerLoad = async () => {
	const s = await setupStatus();
	return {
		apiManagerUrl: s.apiManagerUrl,
		platformAppsUrl: s.platformAppsUrl,
		consumerId: s.consumerId,
		declaration: s.declaration,
		state: s.state,
		problem: s.problem,
		checkedAt: s.checkedAt,
		scopes: s.scopes
	};
};
