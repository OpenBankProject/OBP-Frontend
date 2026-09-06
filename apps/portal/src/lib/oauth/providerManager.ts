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
// App wiring only — strategy, factory and manager logic lives in @obp/shared/server/oauth.
import { OAuth2ProviderManager } from '@obp/shared/server/oauth';
import { obp_requests } from '$lib/obp/requests';
import { oauth2ProviderFactory } from '$lib/oauth/providerFactory';

export type { ProviderStatus } from '@obp/shared/server/oauth';

export const oauth2ProviderManager = new OAuth2ProviderManager(oauth2ProviderFactory, obp_requests, {
	wellKnownEndpoint: '/obp/v5.1.0/well-known'
});
