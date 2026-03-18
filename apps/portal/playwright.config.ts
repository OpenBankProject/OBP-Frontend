import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		reuseExistingServer: true,
		env: {
			// Pass test environment variables to the server
			...process.env
		}
	},
	testDir: 'e2e',
	use: {
		// Run tests in headed mode (visible browser) with slow motion
		headless: false,
		launchOptions: {
			slowMo: 500
		}
	}
});
