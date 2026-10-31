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
// App wiring only — strategy, factory, manager and session logic live in @obp/shared/server/oauth.
import { env } from '$env/dynamic/private';
import {
	GoogleStrategy,
	KeyCloakStrategy,
	OAuth2ProviderFactory,
	OAuth2ProviderManager,
	OBPOIDCStrategy,
	SessionOAuthHelper
} from '@obp/shared/server/oauth';
import { obpRequests } from './obp';

export type { ProviderStatus } from '@obp/shared/server/oauth';

/** The providers OBP-API lists at its well-known endpoint; only those with credentials here can be used. */
export const oauth2ProviderFactory = new OAuth2ProviderFactory([
	new KeyCloakStrategy({
		clientId: env.KEYCLOAK_OAUTH_CLIENT_ID,
		clientSecret: env.KEYCLOAK_OAUTH_CLIENT_SECRET,
		callbackUrl: env.APP_CALLBACK_URL
	}),
	new OBPOIDCStrategy({
		clientId: env.OBP_OAUTH_CLIENT_ID,
		clientSecret: env.OBP_OAUTH_CLIENT_SECRET,
		callbackUrl: env.APP_CALLBACK_URL
	}),
	new GoogleStrategy({
		clientId: env.GOOGLE_OAUTH_CLIENT_ID,
		clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
		callbackUrl: env.APP_CALLBACK_URL
	})
]);

export const oauth2ProviderManager = new OAuth2ProviderManager(oauth2ProviderFactory, obpRequests, {
	wellKnownEndpoint: '/obp/v5.1.0/well-known'
});

export const sessionOAuth = new SessionOAuthHelper(oauth2ProviderFactory);

/** The scopes asked for at login. */
export const LOGIN_SCOPES = ['openid', 'email', 'profile'];

/** Cookie holding the OAuth state between the redirect to the provider and the callback. */
export const OAUTH_STATE_COOKIE = 'obp_cohort_oauth_state';

/** Name of the session cookie. */
export const SESSION_COOKIE = 'obp-cohort.sid';
