/*
 * Copyright (C) 2026 TESOBE GmbH
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
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { colourClasses, cssColours } from '@obp/shared/branding';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return name === 'paraglide' ? [] : sourceFiles(path);
		return /\.(svelte|ts)$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
	});
}

describe('theme colours', () => {
	it('uses only the named colour styles, so a theme decides every colour (see docs/branding.md)', () => {
		const offenders = sourceFiles(SRC).flatMap((path) =>
			colourClasses(readFileSync(path, 'utf8')).map((cls) => `${relative(SRC, path)}: ${cls}`)
		);
		expect(offenders).toEqual([]);
	});

	it('takes every colour in page CSS from the --ui-* variables (see docs/branding.md)', () => {
		const offenders = sourceFiles(SRC)
			.filter((path) => path.endsWith('.svelte'))
			.flatMap((path) => cssColours(readFileSync(path, 'utf8')).map((colour) => `${relative(SRC, path)}: ${colour}`));
		expect(offenders).toEqual([]);
	});
});
