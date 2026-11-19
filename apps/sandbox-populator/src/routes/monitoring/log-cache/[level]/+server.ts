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
import { env } from '$env/dynamic/public';
import { logCacheResponse } from '@obp/shared/server/monitoring';
import { SessionOAuthHelper } from '$lib/oauth/sessionHelper';
import type { RequestHandler } from './$types';

// This app's log cache for a monitor such as OBP-Sentinel, guarded by OBP-API's log cache Roles.
export const GET: RequestHandler = ({ params, request, url, locals }) =>
	logCacheResponse(
		params.level,
		request,
		url,
		env.PUBLIC_OBP_BASE_URL,
		SessionOAuthHelper.getSessionOAuth(locals.session)?.accessToken
	);
