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
import { describe, it, expect, vi } from 'vitest';

// generate.ts reads $env/dynamic/public at module load; provide it.
vi.mock('$env/dynamic/public', () => ({ env: { PUBLIC_OBP_BASE_URL: 'https://obp.example.com' } }));

import { generateIdenticon, userAvatarSeed, roomAvatarSeed } from './generate';

describe('generateIdenticon', () => {
	it('is deterministic for a given seed', () => {
		expect(generateIdenticon('alice')).toEqual(generateIdenticon('alice'));
	});

	it('produces different output for different seeds', () => {
		expect(generateIdenticon('alice')).not.toEqual(generateIdenticon('bob'));
	});

	it('returns a square grid of the requested size', () => {
		const { grid } = generateIdenticon('alice', 5);
		expect(grid).toHaveLength(5);
		for (const row of grid) {
			expect(row).toHaveLength(5);
		}
	});

	it('honors a custom grid size', () => {
		const { grid } = generateIdenticon('alice', 7);
		expect(grid).toHaveLength(7);
		expect(grid[0]).toHaveLength(7);
	});

	it('is horizontally mirror-symmetric', () => {
		const { grid } = generateIdenticon('some-seed', 5);
		for (const row of grid) {
			for (let col = 0; col < row.length; col++) {
				expect(row[col]).toBe(row[row.length - 1 - col]);
			}
		}
	});

	it('emits hsl color and background strings', () => {
		const { color, background } = generateIdenticon('alice');
		expect(color).toMatch(/^hsl\(\d+, 65%, 50%\)$/);
		expect(background).toMatch(/^hsl\(\d+, 30%, 92%\)$/);
	});
});

describe('avatar seeds', () => {
	it('namespaces a user seed with the OBP host', () => {
		expect(userAvatarSeed('bob')).toBe('https://obp.example.com|bob');
	});

	it('namespaces a room seed distinctly from a user seed', () => {
		expect(roomAvatarSeed('room-1')).toBe('https://obp.example.com|room|room-1');
		expect(roomAvatarSeed('bob')).not.toBe(userAvatarSeed('bob'));
	});
});
