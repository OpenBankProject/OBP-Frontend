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
export { OAuth2ClientWithConfig } from './client.js';
export {
	OAuth2ProviderFactory,
	KeyCloakStrategy,
	OBPOIDCStrategy,
	GoogleStrategy
} from './providerFactory.js';
export type { WellKnownUri, OAuthProviderConfig } from './providerFactory.js';
export { OAuth2ProviderManager } from './providerManager.js';
export type {
	ProviderStatus,
	WellKnownRequests,
	OAuth2ProviderManagerOptions
} from './providerManager.js';
export { SessionOAuthHelper } from './sessionHelper.js';
export type { SessionOAuthData } from './sessionHelper.js';
export type {
	OpenIdConnectConfiguration,
	OAuth2AccessTokenPayload,
	SessionOAuthStorageData
} from './types.js';
export { getApplicationAccessToken } from './applicationToken.js';
