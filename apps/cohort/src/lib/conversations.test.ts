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
import { parseMessages } from './conversations';

describe('parseMessages', () => {
	it('reads the recorded messages', () => {
		const json = JSON.stringify([{ id: 'u1', role: 'user', text: 'Who is eligible?', at: '2026-10-31T10:00:00Z' }]);
		expect(parseMessages(json)).toEqual([{ id: 'u1', role: 'user', text: 'Who is eligible?', at: '2026-10-31T10:00:00Z' }]);
	});

	it('gives no messages for anything else', () => {
		expect(parseMessages('not json')).toEqual([]);
		expect(parseMessages('{"a":1}')).toEqual([]);
		expect(parseMessages(undefined)).toEqual([]);
	});
});
