import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		// The shared package's components import each other as $shared/..., as in the other apps
		alias: {
			$shared: '../../packages/shared/src/lib',
			'$shared/*': '../../packages/shared/src/lib/*'
		}
	}
};

export default config;
