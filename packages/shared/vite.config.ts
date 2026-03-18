import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

// Get version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = packageJson.version;

// Get git commit hash
let gitCommit = 'unknown';
try {
	gitCommit = execSync('git rev-parse --short HEAD').toString().trim();
} catch (error) {
	console.warn('Could not get git commit hash:', error);
}

// Get git branch
let gitBranch = 'unknown';
try {
	gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
} catch (error) {
	console.warn('Could not get git branch:', error);
}

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(version),
		__GIT_COMMIT__: JSON.stringify(gitCommit),
		__GIT_BRANCH__: JSON.stringify(gitBranch),
		__BUILD_TIME__: JSON.stringify(new Date().toISOString())
	},
	plugins: [tailwindcss(), sveltekit()],
	test: {
		environment: 'jsdom',
		include: ['src/**/*.{test,spec}.{js,ts}'],
		exclude: ['src/lib/server/**'],
		setupFiles: ['src/test-setup.ts']
	},
	resolve: {
		conditions: ['browser']
	}
});
