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
import { describe, expect, it } from 'vitest';
import { missingToSubmit } from '$lib/applications';
import { examples } from './exampleData';

describe('example data', () => {
	const all = examples();
	const calls = all.flatMap((p) => p.calls);

	it('has every status, so each one can be shown', () => {
		expect(new Set(all.map((p) => p.programme.status))).toEqual(new Set(['open', 'draft']));
		expect(new Set(calls.map((c) => c.status))).toEqual(new Set(['open', 'closed', 'draft']));
	});

	it('submits only applications that are complete', () => {
		for (const a of calls.flatMap((c) => c.applications).filter((a) => a.status === 'submitted')) {
			expect(missingToSubmit(a)).toEqual([]);
		}
	});

	it('has unique names and titles, which is how adding again skips them', () => {
		expect(new Set(all.map((p) => p.programme.name)).size).toBe(all.length);
		expect(new Set(calls.map((c) => c.title)).size).toBe(calls.length);
	});
});
