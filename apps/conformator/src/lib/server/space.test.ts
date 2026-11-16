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
import { isSpaceId, proposedParticipantSpace } from './space';

describe('proposedParticipantSpace', () => {
	it('joins the central space and a slug of the name', () => {
		expect(proposedParticipantSpace('Example Bank SAOG', 'conformator')).toBe('conformator-example-bank-saog');
	});

	it('cuts the slug so the bank id stays within 36 characters', () => {
		const id = proposedParticipantSpace('A Very Long Name For A Payment Service Provider', 'conformator');
		expect(id.length).toBeLessThanOrEqual(36);
		expect(id).toBe('conformator-a-very-long-name-for-a-p');
		expect(isSpaceId(id)).toBe(true);
	});

	it('never ends with a hyphen', () => {
		expect(proposedParticipantSpace('Bank of the ---', 'c')).toBe('c-bank-of-the');
	});

	it('falls back to "participant" when nothing usable is left', () => {
		expect(proposedParticipantSpace('!!!', 'conformator')).toBe('conformator-participant');
	});
});

describe('isSpaceId', () => {
	it('accepts lower-case letters, digits and hyphens', () => {
		expect(isSpaceId('conformator-example-bank')).toBe(true);
	});

	it('refuses capitals, spaces and leading hyphens', () => {
		expect(isSpaceId('Conformance')).toBe(false);
		expect(isSpaceId('a b')).toBe(false);
		expect(isSpaceId('-abc')).toBe(false);
	});
});
