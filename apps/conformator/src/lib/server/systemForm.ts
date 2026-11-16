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
import { isOneOf, SYSTEM_ROLES } from '@obp/shared/conformator';
import { fields, isDocumentUrl } from './forms';

/** A system's fields from its form, and the problems found. Shared by adding and editing a system. */
export function systemFromForm(form: FormData) {
	const { text, problems } = fields(form);
	const body = {
		name: text('name', 'The name', { required: true, max: 255 }),
		system_role: text('system_role', 'What the system is', { required: true }),
		base_url: text('base_url', 'The base URL', { required: true, max: 500 }),
		discovery_url: text('discovery_url', 'The discovery URL', { max: 500 }),
		api_profile: text('api_profile', 'The API profile', { max: 64 }),
		api_version: text('api_version', 'The API version', { max: 32 }),
		runner_client_id: text('runner_client_id', "The runner's client id", { max: 255 })
	};
	if (!isOneOf(SYSTEM_ROLES, body.system_role)) problems.push('Choose what the system is.');
	for (const [name, label] of [['base_url', 'The base URL'], ['discovery_url', 'The discovery URL']] as const) {
		const value = body[name];
		// Participants are reached over TLS only; http is allowed on localhost, for the OBP sandbox as the reference on a laptop.
		if (value && !isDocumentUrl(value)) problems.push(`${label} must start with https:// (or http://localhost for the reference on a laptop).`);
	}
	return { body, problems };
}
