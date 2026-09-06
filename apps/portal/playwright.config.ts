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
