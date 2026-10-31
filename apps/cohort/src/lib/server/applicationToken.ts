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
import { env } from '$env/dynamic/private';
import { requestApplicationAccessToken as requestShared } from '@obp/shared/server/oauth';
import type { ApplicationTokenResult } from '@obp/shared/server/oauth';
import { oauth2ProviderFactory } from './oauth';

/**
 * An application access token (client_credentials grant) for Cohort's own Consumer, for calls made as the
 * app rather than for a logged-in User. Shared implementation, this app's client.
 */
export async function requestApplicationAccessToken(): Promise<ApplicationTokenResult> {
	return requestShared(oauth2ProviderFactory.getPrimaryClient(), env.OBP_OAUTH_CLIENT_ID, env.OBP_OAUTH_CLIENT_SECRET);
}
