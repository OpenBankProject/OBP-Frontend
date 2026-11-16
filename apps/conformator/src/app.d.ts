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
// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Session } from 'svelte-kit-sessions';

declare global {
	namespace App {
		interface Locals {
			session: Session;
		}
	}

	// Build-time injected variables
	const __APP_VERSION__: string;
	const __GIT_COMMIT__: string;
	const __GIT_BRANCH__: string;
	const __BUILD_TIME__: string;
}

declare module 'svelte-kit-sessions' {
	interface SessionData {
		/** GET /obp/v5.1.0/users/current, as returned at login. */
		user?: {
			user_id: string;
			email: string;
			username: string;
			provider?: string;
			entitlements: {
				list: Array<{
					entitlement_id: string;
					role_name: string;
					bank_id: string;
				}>;
			};
		};
		oauth?: {
			access_token: string;
			refresh_token?: string;
			id_token?: string;
			provider: string;
		};
	}
}

export {};
