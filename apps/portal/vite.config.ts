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
import { svelteTesting } from '@testing-library/svelte/vite';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildInfoDefine } from '../../packages/shared/build-info.js';

// Get version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = packageJson.version;

// Walk up to the directory that actually holds the hoisted node_modules. In a
// normal checkout this is the repo root; in a git worktree the dependencies live
// above the worktree boundary, so Vite's default fs.allow can't serve them
// (e.g. @testing-library/svelte's injected cleanup module) — allow that root.
function findDepsRoot(start: string): string {
	let dir = start;
	while (dir !== dirname(dir)) {
		if (existsSync(join(dir, 'node_modules', '@testing-library'))) return dir;
		dir = dirname(dir);
	}
	return start;
}
const depsRoot = findDepsRoot(dirname(fileURLToPath(import.meta.url)));

export default defineConfig({
	server: { port: 5174, fs: { allow: [depsRoot] } },
	define: buildInfoDefine(version),
	plugins: [tailwindcss(), sveltekit()],
	test: {
		workspace: [
			{
				extends: './vite.config.ts',
				plugins: [svelteTesting()],
				test: {
					name: 'client',
					environment: 'jsdom',
					clearMocks: true,
					include: ['src/**/*.svelte.{test,spec}.{js,ts}', 'test/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts', './test/setup.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}', 'test/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}', 'test/**/*.svelte.{test,spec}.{js,ts}'],
					setupFiles: ['./test/setup-server.ts']
				}
			}
		]
	}
});
