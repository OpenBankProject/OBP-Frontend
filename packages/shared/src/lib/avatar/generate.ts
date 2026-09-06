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
/**
 * Deterministic identicon generator.
 *
 * Given a seed string, produces a small symmetric pixel grid and an accent
 * colour. Pure function — same seed always yields the same result, so other
 * clients can render the same avatar without any storage.
 *
 * For user avatars, prefer `userAvatarSeed(username)` which namespaces the
 * seed with the OBP host so the same username on a different OBP instance
 * renders differently.
 */

import { env } from '$env/dynamic/public';

export function userAvatarSeed(username: string): string {
	const host = env.PUBLIC_OBP_BASE_URL ?? '';
	return `${host}|${username}`;
}

export function roomAvatarSeed(chatRoomId: string): string {
	const host = env.PUBLIC_OBP_BASE_URL ?? '';
	return `${host}|room|${chatRoomId}`;
}

function hashSeed(seed: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

function mulberry32(seed: number): () => number {
	let s = seed >>> 0;
	return function () {
		s = (s + 0x6d2b79f5) | 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export interface Identicon {
	grid: boolean[][];
	color: string;
	background: string;
}

export function generateIdenticon(seed: string, gridSize = 5): Identicon {
	const rng = mulberry32(hashSeed(seed));
	const halfWidth = Math.ceil(gridSize / 2);

	const hue = Math.floor(rng() * 360);
	const bgHue = (hue + 180) % 360;

	const grid: boolean[][] = [];
	for (let row = 0; row < gridSize; row++) {
		const r: boolean[] = new Array(gridSize);
		for (let col = 0; col < halfWidth; col++) {
			r[col] = rng() < 0.5;
		}
		for (let col = halfWidth; col < gridSize; col++) {
			r[col] = r[gridSize - 1 - col];
		}
		grid.push(r);
	}

	return {
		grid,
		color: `hsl(${hue}, 65%, 50%)`,
		background: `hsl(${bgHue}, 30%, 92%)`
	};
}
