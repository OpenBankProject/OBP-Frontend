// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
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
