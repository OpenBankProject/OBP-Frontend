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
import { describe, it, expect } from 'vitest';
import { parseDescription, resolveGlossaryHref } from './description.js';

const GET_BANKS = `Get banks on this API instance
Returns a list of banks supported on this server:

- bank_id used as parameter in URLs

User Authentication is Optional. The User need not be logged in.

**JSON response body fields:**

**address**: 

[**bank_code**](/glossary#bank_code): CGHZ

[**bank_id**](/glossary#Bank.bank_id): gh.29.uk

[attributes](/glossary#attributes): attribute value in form of (name, value)
`;

describe('parseDescription', () => {
	it('keeps the prose and lifts the field list out of it', () => {
		const { prose, sections } = parseDescription(GET_BANKS);

		expect(prose).toContain('Get banks on this API instance');
		expect(prose).toContain('User Authentication is Optional');
		expect(prose).not.toContain('bank_code');

		expect(sections).toHaveLength(1);
		expect(sections[0].title).toBe('JSON response body fields');
		expect(sections[0].fields.map((f) => f.name)).toEqual([
			'address',
			'bank_code',
			'bank_id',
			'attributes'
		]);
	});

	it('reads the term, its glossary link and its example', () => {
		const [bankId] = parseDescription(GET_BANKS).sections[0].fields.filter(
			(f) => f.name === 'bank_id'
		);
		expect(bankId.glossaryHref).toBe('/glossary#Bank.bank_id');
		expect(bankId.text).toBe('gh.29.uk');
	});

	it('keeps a field with no example', () => {
		const address = parseDescription(GET_BANKS).sections[0].fields[0];
		expect(address).toEqual({ name: 'address', glossaryHref: undefined, text: '' });
	});

	it('separates request and response sections', () => {
		const { sections } = parseDescription(
			'Intro\n\n**JSON request body fields:**\n\n**a**: 1\n\n**JSON response body fields:**\n\n**b**: 2\n'
		);
		expect(sections.map((s) => s.title)).toEqual([
			'JSON request body fields',
			'JSON response body fields'
		]);
		expect(sections[1].fields[0].name).toBe('b');
	});

	it('does not silently drop a non-field line inside a section', () => {
		const { sections } = parseDescription('**JSON response body fields:**\n\nSee the glossary.\n');
		expect(sections[0].fields).toHaveLength(0);
		expect(sections[0].extra).toBe('See the glossary.');
	});

	it('leaves a description with no field list alone', () => {
		const { prose, sections } = parseDescription('Just prose.');
		expect(prose).toBe('Just prose.');
		expect(sections).toEqual([]);
	});

	it('handles an empty description', () => {
		expect(parseDescription('')).toEqual({ prose: '', sections: [] });
	});
});

describe('resolveGlossaryHref', () => {
	it('points site-relative glossary links at a base that serves one', () => {
		expect(resolveGlossaryHref('/glossary#bank_id', 'https://explorer.example.com/')).toBe(
			'https://explorer.example.com/glossary#bank_id'
		);
	});

	it('leaves other links and absent links alone', () => {
		expect(resolveGlossaryHref('https://example.com/x', 'https://e.com')).toBe('https://example.com/x');
		expect(resolveGlossaryHref(undefined, 'https://e.com')).toBeUndefined();
	});
});
