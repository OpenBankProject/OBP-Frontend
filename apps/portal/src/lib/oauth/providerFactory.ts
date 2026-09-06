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
import { env } from '$env/dynamic/private';
import {
	OAuth2ProviderFactory,
	KeyCloakStrategy,
	OBPOIDCStrategy,
	GoogleStrategy
} from '@obp/shared/server/oauth';

export type { WellKnownUri } from '@obp/shared/server/oauth';
export { OAuth2ProviderFactory } from '@obp/shared/server/oauth';

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
