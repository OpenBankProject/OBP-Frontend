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
import { parseOpenApi, schemaChecker } from './schema';

const doc = {
	openapi: '3.1.0',
	components: {
		schemas: {
			Amount: { type: 'string', pattern: '^\\d+\\.\\d{3}$', example: '10.000' },
			Balance: {
				type: 'object',
				required: ['account_id', 'amount', 'currency'],
				properties: { account_id: { type: 'string' }, amount: { $ref: '#/components/schemas/Amount' }, currency: { type: 'string', enum: ['OMR'] } }
			}
		}
	}
};

describe('schemaChecker', () => {
	const check = schemaChecker(doc);

	it('passes a value that fits, following refs inside the document', () => {
		expect(check('#/components/schemas/Balance', { account_id: 'a', amount: '1520.375', currency: 'OMR' })).toEqual({ problems: [] });
	});

	it('says where a value does not fit', () => {
		const outcome = check('#/components/schemas/Balance', { account_id: 'a', amount: '1520.37', currency: 'USD' });
		expect('problems' in outcome && outcome.problems.length).toBe(2);
		expect(JSON.stringify(outcome)).toContain('/amount');
		expect(JSON.stringify(outcome)).toContain('/currency');
	});

	it('names a missing required field', () => {
		const outcome = check('#/components/schemas/Balance', { account_id: 'a', currency: 'OMR' });
		expect(JSON.stringify(outcome)).toContain('amount');
	});

	it('cannot check a schema the document does not have, or a ref outside it', () => {
		expect(check('#/components/schemas/Nope', {})).toEqual({ cannot: "The suite's OpenAPI document has no schema at #/components/schemas/Nope." });
		expect('cannot' in check('https://elsewhere/schema.json', {})).toBe(true);
	});
});

describe('parseOpenApi', () => {
	it('reads OpenAPI 3.1 JSON', () => {
		expect(parseOpenApi(JSON.stringify(doc), 'x')).toEqual({ document: doc });
	});

	it('reads OpenAPI YAML, as the Berlin Group publishes it', () => {
		const yaml = 'openapi: 3.0.1\npaths:\n  /accounts:\n    get:\n      responses:\n        "200":\n          description: OK\n';
		const read = parseOpenApi(yaml, 'u') as { document: any };
		expect(read.document.openapi).toBe('3.0.1');
		expect(read.document.paths['/accounts'].get.responses['200'].description).toBe('OK');
	});

	it('refuses text that is neither JSON nor YAML, and older versions, saying why', () => {
		const unreadable = parseOpenApi('openapi: [3.1', 'u') as { cannot: string };
		expect(unreadable.cannot).toMatch(/^The OpenAPI document at u cannot be read\. The document is neither JSON nor YAML/);
		expect(parseOpenApi('{"swagger":"2.0"}', 'u')).toEqual({ cannot: 'The document at u is not OpenAPI 3.0 or 3.1 (it says 2.0).' });
		expect('document' in parseOpenApi('{"openapi":"3.0.3"}', 'u')).toBe(true);
	});
});

describe('schemaChecker with a pointer into a path', () => {
	// The kind of pointer the endpoint picker writes: into an operation's response, with ~1 for / and a path parameter.
	const paths = {
		openapi: '3.1.0',
		paths: {
			'/accounts/{accountid}/balances': {
				get: { responses: { '200': { content: { 'application/json': { schema: { type: 'object', required: ['data'], properties: { data: { type: 'array' } } } } } } } }
			}
		}
	};
	const ref = '#/paths/~1accounts~1{accountid}~1balances/get/responses/200/content/application~1json/schema';

	it('follows it, passing and failing as the schema says', () => {
		const check = schemaChecker(paths);
		expect(check(ref, { data: [] })).toEqual({ problems: [] });
		const missing = check(ref, { other: 1 });
		expect('problems' in missing && missing.problems.length).toBe(1);
	});
});
