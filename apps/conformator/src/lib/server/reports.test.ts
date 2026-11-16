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
import { describe, expect, it } from 'vitest';
import { newReference } from './reports';

describe('newReference', () => {
	it('is CR, the year and eight letters or digits without look-alikes', () => {
		const ref = newReference(2026, Buffer.from([0, 1, 2, 3, 30, 31, 61, 255]));
		expect(ref).toMatch(/^CR-2026-[A-Z2-9]{8}$/);
		// No 0, 1, I, L or O, which are easily misread when a reference is typed in.
		expect(ref.slice('CR-2026-'.length)).not.toMatch(/[01ILO]/);
	});
});
