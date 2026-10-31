// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Session } from 'svelte-kit-sessions';
import type { Locale } from '$lib/i18n';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: Session;
			locale: Locale;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
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
