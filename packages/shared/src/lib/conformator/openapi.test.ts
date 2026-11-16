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
import { openApiOperations, stepForOperation } from './index.js';

const doc = {
	openapi: '3.1.0',
	paths: {
		'/open-banking/v3.1/accounts/{accountid}/balances': {
			get: {
				operationId: 'UKv3.1-getAccountBalances',
				summary: 'Get Account Balances',
				tags: ['Balances'],
				responses: { '200': { content: { 'application/json': { schema: { type: 'object' } } } } }
			}
		},
		'/open-banking/v3.1/account-access-consents': {
			post: { operationId: 'createConsent', summary: 'Create a consent', requestBody: {}, responses: { '201': { description: 'Created' } } },
			parameters: [{ name: 'x' }]
		}
	}
};

describe('openApiOperations', () => {
	it('lists each operation with its success status and response schema pointer', () => {
		const ops = openApiOperations(doc);
		expect(ops.map((o) => `${o.method} ${o.path}`)).toEqual(['POST /open-banking/v3.1/account-access-consents', 'GET /open-banking/v3.1/accounts/{accountid}/balances']);
		expect(ops[0]).toMatchObject({ operationId: 'createConsent', successStatus: 201, schemaPointer: null, hasBody: true, tag: 'Other' });
		expect(ops[1]).toMatchObject({
			tag: 'Balances',
			successStatus: 200,
			schemaPointer: '#/paths/~1open-banking~1v3.1~1accounts~1{accountid}~1balances/get/responses/200/content/application~1json/schema'
		});
	});

	it('follows a reference to a shared response, and takes a JSON media type with parameters', () => {
		const shared = {
			openapi: '3.0.1',
			paths: {
				'/accounts': { get: { responses: { '200': { $ref: '#/components/responses/200AccountsRead' } } } },
				'/balances': { get: { responses: { '200': { content: { 'application/jose+jwe': { schema: {} }, 'application/json; charset=utf-8': { schema: {} } } } } } },
				'/statements': { get: { responses: { '200': { $ref: '#/components/responses/Missing' } } } }
			},
			components: { responses: { '200AccountsRead': { content: { 'application/json': { schema: { $ref: '#/components/schemas/OBReadAccount6' } } } } } }
		};
		const [accounts, balances, statements] = openApiOperations(shared);
		expect(accounts.schemaPointer).toBe('#/components/responses/200AccountsRead/content/application~1json/schema');
		expect(balances.schemaPointer).toBe('#/paths/~1balances/get/responses/200/content/application~1json; charset=utf-8/schema');
		expect(statements.schemaPointer).toBeNull();
	});

	it('gives nothing for a document without paths', () => {
		expect(openApiOperations({})).toEqual([]);
		expect(openApiOperations(null)).toEqual([]);
	});
});

describe('stepForOperation', () => {
	it('calls the operation and expects its status and schema, with path parameters to be kept by an earlier step', () => {
		const [, balances] = openApiOperations(doc);
		expect(stepForOperation(balances)).toEqual({
			kind: 'request',
			name: 'Get Account Balances',
			method: 'GET',
			path: '/open-banking/v3.1/accounts/{{accountid}}/balances',
			credentials: 'client',
			expect: [{ status: 200 }, { schema: balances.schemaPointer }]
		});
	});

	it('makes a placeholder name from a path parameter with a hyphen in it', () => {
		const [op] = openApiOperations({ openapi: '3.0.1', paths: { '/v1/{payment-service}/{payment-product}': { post: { responses: {} } } } });
		expect(stepForOperation(op).path).toBe('/v1/{{payment_service}}/{{payment_product}}');
	});

	it('gives a body to fill in when the operation takes one', () => {
		expect(stepForOperation(openApiOperations(doc)[0]).body).toEqual({});
	});
});
