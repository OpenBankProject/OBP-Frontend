// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

declare module 'svelte-kit-sessions' {
	interface SessionData {
		oauth?: {
			provider: string;
			access_token: string;
			refresh_token?: string;
		};
		user?: {
			user_id: string;
			email: string;
			username: string;
		};
	}
}

declare global {
	const __APP_VERSION__: string;
	const __GIT_COMMIT__: string;
	const __GIT_BRANCH__: string;
	const __BUILD_TIME__: string;

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
