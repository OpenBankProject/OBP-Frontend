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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(__dirname, '..', '..', '..');

/**
 * adapter-node bundles every package that is not in the app's own `dependencies` into the ESM server build.
 * jsdom loads parts of itself with `require` at run time, so once bundled it fails with "require is not
 * defined in ES module scope". The shared landing sanitiser uses jsdom with DOMPurify; an app that imports it
 * must list both, as Portal and API Manager do.
 */
const SANITISER_PACKAGES = ['jsdom', 'dompurify'];

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return sourceFiles(path);
		return /\.(ts|js|svelte)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});
}

describe('server dependencies', () => {
	it('lists the packages of the landing sanitiser it imports, so the server build keeps them external', () => {
		const importsSanitiser = sourceFiles(join(APP, 'src')).some((file) =>
			/from ['"]@obp\/shared\/server\/landing['"]|sanitizePageHtml|sanitizeContentHtml/.test(
				readFileSync(file, 'utf8')
			)
		);
		expect(importsSanitiser).toBe(true);
		const dependencies =
			JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8')).dependencies ?? {};
		expect(SANITISER_PACKAGES.filter((name) => !(name in dependencies))).toEqual([]);
	});
});
