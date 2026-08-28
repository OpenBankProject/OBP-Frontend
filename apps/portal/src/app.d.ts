// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Session } from 'svelte-kit-sessions';
import type { RateLimitInfo } from '@obp/shared/server/rate-limit';
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			session: Session;
			/** Set by the rate-limit hook when this form POST must be refused. */
			rateLimit?: RateLimitInfo;
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

export {};
