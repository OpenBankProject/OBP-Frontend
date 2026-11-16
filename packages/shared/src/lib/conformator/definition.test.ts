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
import { isTestId, parseTestDefinition, unsavedPlaceholders } from './index.js';

const consentThenAccounts = {
	steps: [
		{
			kind: 'request',
			name: 'Create a consent',
			method: 'POST',
			path: '/account-access-consents',
			credentials: 'client',
			body: { permissions: ['ReadAccountsBasic'] },
			save: { consent_id: 'body:/data/consent_id' },
			expect: [{ status: 201 }, { field: '/data/status', equals: 'AwaitingAuthorisation' }]
		},
		{ kind: 'wait', name: 'Let the customer authorise', seconds: 5 },
		{
			kind: 'request',
			name: 'Read the accounts',
			method: 'GET',
			path: '/accounts',
			headers: { 'x-consent-id': '{{consent_id}}' },
			credentials: 'customer',
			expect: [{ status: 200 }, { header: 'x-fapi-interaction-id', present: true }]
		}
	]
};

describe('parseTestDefinition', () => {
	it('accepts a valid definition', () => {
		const result = parseTestDefinition(JSON.stringify(consentThenAccounts));
		expect(result.ok).toBe(true);
	});

	it('reports text that is not JSON', () => {
		const result = parseTestDefinition('{steps: ');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.problems[0]).toMatch(/not valid JSON/);
	});

	it('needs at least one step', () => {
		const result = parseTestDefinition('{"steps": []}');
		expect(result).toEqual({ ok: false, problems: ['The definition has no steps.'] });
	});

	it('lists every problem at once', () => {
		const result = parseTestDefinition(
			JSON.stringify({
				steps: [
					{ kind: 'request', name: '', method: 'FETCH', path: 'accounts', credentials: 'root', save: { id: 'json:/id' } },
					{ kind: 'wait', name: 'Too long', seconds: 3600 },
					{ kind: 'check', name: 'Bad name', check: 'FAPI2' },
					{ kind: 'sleep', name: 'Unknown' }
				]
			})
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.problems).toEqual([
				'Step 1 has no name.',
				'Step 1 has a method that is not one of GET, POST, PUT, PATCH, DELETE.',
				'Step 1 has a path that does not start with /.',
				'Step 1 has credentials that are not one of none, client, customer.',
				'Step 1 saves id from "json:/id", which is not body:/<pointer> or header:<name>.',
				'Step 2 waits for a number of seconds that is not between 1 and 300.',
				'Step 3 names a check that is not <group>:<name>, such as openid:fapi2-security-profile.',
				'Step 4 has a kind that is not request, wait or check.'
			]);
		}
	});

	it('checks each expectation', () => {
		const result = parseTestDefinition(
			JSON.stringify({
				steps: [{ kind: 'request', name: 'Get', method: 'GET', path: '/a', credentials: 'none', expect: [{ status: 42 }, { field: 'data.status', equals: 'x' }, { colour: 'red' }] }]
			})
		);
		expect(result.ok).toBe(false);
		if (!result.ok)
			expect(result.problems).toEqual([
				'Step 1, expectation 1 has a status that is not an HTTP status code.',
				'Step 1, expectation 2 has a field that is not a JSON pointer such as /data/status.',
				'Step 1, expectation 3 is not a status, schema, field or header expectation.'
			]);
	});
});

describe('unsavedPlaceholders', () => {
	it('finds nothing when every value is saved first', () => {
		const result = parseTestDefinition(JSON.stringify(consentThenAccounts));
		if (!result.ok) throw new Error('fixture should parse');
		expect(unsavedPlaceholders(result.definition)).toEqual([]);
	});

	it('finds a value used before it is saved', () => {
		const result = parseTestDefinition(
			JSON.stringify({ steps: [{ kind: 'request', name: 'Get', method: 'GET', path: '/payments/{{payment_id}}', credentials: 'client' }] })
		);
		if (!result.ok) throw new Error('fixture should parse');
		expect(unsavedPlaceholders(result.definition)).toEqual(['Step 1 uses {{payment_id}} before any step saves it.']);
	});
});

describe('isTestId', () => {
	it('accepts IDs such as PIS-IDEM-004', () => {
		expect(isTestId('PIS-IDEM-004')).toBe(true);
		expect(isTestId('AIS-001')).toBe(true);
	});

	it('refuses lower case, single groups and spaces', () => {
		expect(isTestId('pis-idem-004')).toBe(false);
		expect(isTestId('PIS')).toBe(false);
		expect(isTestId('PIS IDEM 004')).toBe(false);
	});
});

describe('the example suite', () => {
	it('has a valid definition for every automated test, with every value saved before use', async () => {
		const { EXAMPLE_TESTS } = await import('./example.js');
		for (const test of EXAMPLE_TESTS.filter((t) => t.kind === 'automated')) {
			const result = parseTestDefinition(JSON.stringify(test.definition));
			expect(result.ok, test.test_id).toBe(true);
			if (result.ok) expect(unsavedPlaceholders(result.definition), test.test_id).toEqual([]);
		}
	});
});
