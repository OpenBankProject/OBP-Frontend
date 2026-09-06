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
import { execSync } from 'child_process';

/**
 * Resolve build-time provenance for an app: version, git commit, git branch and build time.
 *
 * Git values prefer the GIT_COMMIT / GIT_BRANCH environment variables — set as Docker
 * build args in CI, where the `.git` directory is intentionally not copied into the image —
 * and fall back to running git locally for `npm run dev` / local builds. When neither is
 * available the value is the literal string 'unknown', which the UI hides.
 *
 * @param {string} version - the app's own package.json version
 * @returns {{ version: string, gitCommit: string, gitBranch: string, buildTime: string }}
 */
export function getBuildInfo(version) {
	let gitCommit = process.env.GIT_COMMIT?.trim().slice(0, 7) || 'unknown';
	if (gitCommit === 'unknown') {
		try {
			gitCommit = execSync('git rev-parse --short HEAD').toString().trim();
		} catch (error) {
			console.warn('Could not get git commit hash:', error);
		}
	}

	let gitBranch = process.env.GIT_BRANCH?.trim() || 'unknown';
	if (gitBranch === 'unknown') {
		try {
			gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
		} catch (error) {
			console.warn('Could not get git branch:', error);
		}
	}

	return { version, gitCommit, gitBranch, buildTime: new Date().toISOString() };
}

/**
 * Build the Vite `define` map for the build-info globals (`__APP_VERSION__`,
 * `__GIT_COMMIT__`, `__GIT_BRANCH__`, `__BUILD_TIME__`). Spread into a Vite config's
 * `define` block so the values are inlined at build time.
 *
 * @param {string} version - the app's own package.json version
 * @returns {Record<string, string>}
 */
export function buildInfoDefine(version) {
	const info = getBuildInfo(version);
	return {
		__APP_VERSION__: JSON.stringify(info.version),
		__GIT_COMMIT__: JSON.stringify(info.gitCommit),
		__GIT_BRANCH__: JSON.stringify(info.gitBranch),
		__BUILD_TIME__: JSON.stringify(info.buildTime)
	};
}
