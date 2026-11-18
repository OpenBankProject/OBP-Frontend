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
import { getContext, setContext } from 'svelte';

/**
 * What the shared role widgets (MissingRoleAlert, PageRoleCheck, SpaceRoleAlerts) need from the app they are in:
 * where to send an entitlement request, where administrators accept requests, the bank chosen in the app, and whether a
 * Role needs a bank. Each app sets it once, in its layout; without it the defaults below apply.
 */
export interface RoleRequests {
	/** The app's own endpoint that sends `{ role_name, bank_id }` to OBP-API as the logged-in User. */
	requestUrl: string;
	/** The page where administrators accept requests (in the API Manager). */
	requestsPageUrl: string;
	/** Where the User chooses a bank, for a bank Role asked for without one. */
	selectBankUrl: string;
	/** The bank chosen in the app, if it has one. */
	currentBankId: () => string;
	/** Whether a Role must be held at a bank. Without it, a Role given a bank id is a bank Role and one without is not. */
	roleRequiresBank?: (roleName: string) => Promise<boolean>;
}

const KEY = Symbol.for('obp.shared.roleRequests');

const DEFAULTS: RoleRequests = {
	requestUrl: '/backend/rbac/entitlement-requests',
	requestsPageUrl: '/rbac/entitlement-requests',
	selectBankUrl: '/user',
	currentBankId: () => ''
};

/** Set the app's role request wiring for every role widget below this component. */
export function setRoleRequests(value: Partial<RoleRequests>): void {
	setContext(KEY, { ...DEFAULTS, ...value });
}

/** The app's role request wiring, or the defaults. */
export function getRoleRequests(): RoleRequests {
	return getContext<RoleRequests | undefined>(KEY) ?? DEFAULTS;
}
