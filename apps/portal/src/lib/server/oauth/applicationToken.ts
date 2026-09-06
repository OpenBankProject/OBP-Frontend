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
import { oauth2ProviderFactory } from '$lib/oauth/providerFactory';
import { env } from '$env/dynamic/private';
import { getApplicationAccessToken as getShared } from '@obp/shared/server/oauth';

/**
 * An application access token (client_credentials grant) for the Portal's own consumer, so
 * server code can read OBP without a visitor's session, e.g. published pages for anonymous
 * visitors. Shared implementation, this app's client.
 */
export async function getApplicationAccessToken(): Promise<string | null> {
	return getShared(oauth2ProviderFactory.getPrimaryClient(), env.OBP_OAUTH_CLIENT_ID, env.OBP_OAUTH_CLIENT_SECRET);
}
