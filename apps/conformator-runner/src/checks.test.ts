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
import { atPointer, MissingValue, missedExpectations, sanitise, substitute, valueToSave } from './checks';

describe('substitute', () => {
	it('fills placeholders in text, lists and objects', () => {
		expect(substitute({ path: '/consents/{{id}}', list: ['{{id}}', 3] }, { id: 'c1' })).toEqual({ path: '/consents/c1', list: ['c1', 3] });
	});

	it('refuses a placeholder no step saved', () => {
		expect(() => substitute('/payments/{{payment_id}}', {})).toThrow(MissingValue);
	});
});

describe('atPointer', () => {
	const doc = { data: { items: [{ id: 'a' }], 'a/b': 1, 'm~n': 2 } };
	it('follows objects and lists', () => {
		expect(atPointer(doc, '/data/items/0/id')).toBe('a');
	});
	it('reads escaped keys', () => {
		expect(atPointer(doc, '/data/a~1b')).toBe(1);
		expect(atPointer(doc, '/data/m~0n')).toBe(2);
	});
	it('gives undefined for a missing path', () => {
		expect(atPointer(doc, '/data/none/x')).toBeUndefined();
	});
});

describe('missedExpectations', () => {
	const response = { status: 201, headers: { 'x-fapi-interaction-id': 'i1' }, json: { data: { status: 'AwaitingAuthorisation' } } };

	it('passes when every expectation is met', () => {
		expect(
			missedExpectations(
				[{ status: 201 }, { field: '/data/status', equals: 'AwaitingAuthorisation' }, { header: 'X-FAPI-Interaction-ID', present: true }],
				response
			)
		).toEqual([]);
	});

	it('says what was expected and what came back', () => {
		expect(missedExpectations([{ status: 200 }, { field: '/data/status', equals: 'Authorised' }, { header: 'location', present: true }], response).map((m) => m.text)).toEqual([
			'Expected status 200, got 201.',
			'Expected /data/status to be "Authorised", got "AwaitingAuthorisation".',
			'Expected the header location, which is missing.'
		]);
	});

	it('marks schema checks as impossible without the suite\'s OpenAPI document', () => {
		expect(missedExpectations([{ schema: '#/components/schemas/Consent' }], response)).toEqual([
			{ text: 'The suite names no OpenAPI document, so the body cannot be checked against #/components/schemas/Consent.', unsupported: true }
		]);
	});

	it('uses the schema check it is given', () => {
		expect(missedExpectations([{ schema: '#/a' }], response, () => ({ problems: [] }))).toEqual([]);
		expect(missedExpectations([{ schema: '#/a' }], response, () => ({ problems: ['/data/status: wrong'] }))).toEqual([{ text: 'Expected the body to match #/a: /data/status: wrong.' }]);
		expect(missedExpectations([{ schema: '#/a' }], response, () => ({ cannot: 'No such schema.' }))).toEqual([{ text: 'No such schema.', unsupported: true }]);
	});
});

describe('valueToSave', () => {
	const response = { status: 201, headers: { location: '/consents/c1' }, json: { data: { consent_id: 'c1', nested: { a: 1 } } } };
	it('reads from the body or a header', () => {
		expect(valueToSave('body:/data/consent_id', response)).toBe('c1');
		expect(valueToSave('header:Location', response)).toBe('/consents/c1');
	});
	it('gives undefined for a missing value or an object', () => {
		expect(valueToSave('body:/data/none', response)).toBeUndefined();
		expect(valueToSave('body:/data/nested', response)).toBeUndefined();
	});
});

describe('sanitise', () => {
	it('hides tokens and secrets at any depth', () => {
		expect(sanitise({ headers: { Authorization: 'Bearer x' }, body: { access_token: 't', data: { amount: '1.000' } } })).toEqual({
			headers: { Authorization: '(hidden)' },
			body: { access_token: '(hidden)', data: { amount: '1.000' } }
		});
	});
	it('cuts long text', () => {
		expect(String(sanitise('x'.repeat(3000))).endsWith('... (cut)')).toBe(true);
	});
});
