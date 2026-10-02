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
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/public';
import { createObpProxyHandler } from '@obp/shared/server/obp';

// Calls a Dynamic Endpoint (e.g. a Dynamic Resource Doc) as a caller who is not logged in,
// so an operator can see what the public gets. The operator must be logged in to the Manager;
// OBP receives no Authorization header. GET only, and only under /obp/dynamic-endpoint.
export const GET: RequestHandler = createObpProxyHandler(env.PUBLIC_OBP_BASE_URL, {
	pathPrefix: '/obp/dynamic-endpoint',
	authHeaders: () => ({}),
});
