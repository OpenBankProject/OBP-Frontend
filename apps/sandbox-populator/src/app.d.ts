// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session } from 'svelte-kit-sessions';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: Session<SessionData>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Build-time variables
	declare const __APP_VERSION__: string;
	declare const __GIT_COMMIT__: string;
	declare const __GIT_BRANCH__: string;
	declare const __BUILD_TIME__: string;
}

interface SessionData {
	user?: {
		user_id: string;
		email: string;
		username: string;
		entitlements: { list: Array<{ bank_id: string; role_name: string }> };
		views: { list: object[] };
	};
	oauth?: {
		access_token: string;
		refresh_token?: string;
		provider: string;
	};
}

export {};
