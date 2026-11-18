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
import type { TestDefinition } from './definition.js';

/**
 * An example suite for trying Conformator, written against the fake bank in apps/conformator-runner/dev. Its
 * requirements belong to a made-up "Example framework", not to any regulator's rules.
 */

export interface ExampleRequirement {
	key: string;
	reference: string;
	title: string;
	wording: string;
}

export interface ExampleTest {
	test_id: string;
	title: string;
	kind: 'automated' | 'evidence' | 'control';
	mandatory: boolean;
	severity: 'critical' | 'high' | 'medium' | 'low';
	requirements: string[];
	expected_result: string;
	evidence_required?: string;
	suggested_fix?: string;
	definition?: TestDefinition;
}

export const EXAMPLE_SOURCE = 'Example framework (not a real regulation)';

export const EXAMPLE_REQUIREMENTS: ExampleRequirement[] = [
	{ key: 'create', reference: 'DEMO 1.1', title: 'Creating a consent', wording: 'A provider records a consent with the permissions asked for, awaiting the customer.' },
	{ key: 'revoke', reference: 'DEMO 1.2', title: 'Revoking a consent', wording: 'A revoked consent shows as revoked, and gives no further access.' },
	{ key: 'validate', reference: 'DEMO 1.3', title: 'Checking requests', wording: 'A provider refuses a consent request that asks for no permissions.' },
	{ key: 'accounts', reference: 'DEMO 2.1', title: 'Account information', wording: 'An authorised customer can read their accounts and balances, in Omani rials with three decimals.' },
	{ key: 'audit', reference: 'DEMO 3.1', title: 'Keeping records', wording: 'A provider keeps a record of every consent and its changes for audit.' },
	{ key: 'security', reference: 'DEMO 3.2', title: 'Responsibility for security', wording: 'A named person is responsible for the security of the open banking APIs.' }
];

/**
 * The OpenAPI 3.1 document of the example suite: the shapes the fake bank's answers must have. The web app serves it,
 * and the example suite names it, so the runner checks responses against these schemas.
 */
export const EXAMPLE_OPENAPI = {
	openapi: '3.1.0',
	info: { title: 'Example account information API', version: '1.0.0' },
	paths: {},
	components: {
		schemas: {
			Amount: { type: 'string', pattern: '^-?\\d+\\.\\d{3}$', description: 'An amount in Omani rials, with three decimals.' },
			Consent: {
				type: 'object',
				required: ['data'],
				properties: {
					data: {
						type: 'object',
						required: ['consent_id', 'status', 'permissions'],
						properties: {
							consent_id: { type: 'string', minLength: 1 },
							status: { type: 'string', enum: ['AwaitingAuthorisation', 'Authorised', 'Rejected', 'Revoked'] },
							permissions: { type: 'array', minItems: 1, items: { type: 'string' } },
							created_at: { type: 'string', format: 'date-time' }
						}
					}
				}
			},
			Accounts: {
				type: 'object',
				required: ['data'],
				properties: {
					data: {
						type: 'array',
						items: {
							type: 'object',
							required: ['account_id', 'currency'],
							properties: { account_id: { type: 'string' }, currency: { const: 'OMR' }, nickname: { type: 'string' } }
						}
					}
				}
			},
			Balance: {
				type: 'object',
				required: ['data'],
				properties: {
					data: {
						type: 'object',
						required: ['account_id', 'amount', 'currency'],
						properties: { account_id: { type: 'string' }, amount: { $ref: '#/components/schemas/Amount' }, currency: { const: 'OMR' } }
					}
				}
			}
		}
	}
};

/** Where the web app serves the example OpenAPI document, after its ORIGIN. */
export const EXAMPLE_OPENAPI_PATH = '/catalogue/example-openapi.json';

const consent = { kind: 'request' as const, name: 'Create a consent', method: 'POST' as const, path: '/account-access-consents', credentials: 'client' as const };

export const EXAMPLE_SUITE = {
	code: 'EXAMPLE-AIS',
	name: 'Example: account information provider',
	// 1.1.0: the test IDs and requirement references became DEMO-, from EX- (which reads as "ex-convict").
	version: '1.1.0',
	system_role: 'api_provider',
	api_family: 'account_information',
	description: 'An example suite for trying Conformator against the fake bank. Its tests trace to a made-up framework.'
};

export const EXAMPLE_TESTS: ExampleTest[] = [
	{
		test_id: 'DEMO-CONSENT-001',
		title: 'A consent can be created and read back',
		kind: 'automated',
		mandatory: true,
		severity: 'high',
		requirements: ['create'],
		expected_result: 'The consent is created awaiting authorisation, and reads back the same.',
		suggested_fix: 'Create new consents with the status AwaitingAuthorisation.',
		definition: {
			steps: [
				{ ...consent, body: { permissions: ['ReadAccountsBasic', 'ReadBalances'] }, save: { consent_id: 'body:/data/consent_id' }, expect: [{ status: 201 }, { field: '/data/status', equals: 'AwaitingAuthorisation' }, { schema: '#/components/schemas/Consent' }] },
				{ kind: 'request', name: 'Read the consent', method: 'GET', path: '/account-access-consents/{{consent_id}}', credentials: 'client', expect: [{ status: 200 }, { field: '/data/status', equals: 'AwaitingAuthorisation' }] }
			]
		}
	},
	{
		test_id: 'DEMO-CONSENT-002',
		title: 'A revoked consent shows as revoked',
		kind: 'automated',
		mandatory: true,
		severity: 'high',
		requirements: ['revoke'],
		expected_result: 'After revocation the consent reads back as Revoked.',
		suggested_fix: 'Set the status to Revoked when a consent is deleted.',
		definition: {
			steps: [
				{ ...consent, body: { permissions: ['ReadAccountsBasic'] }, save: { consent_id: 'body:/data/consent_id' }, expect: [{ status: 201 }] },
				{ kind: 'request', name: 'Revoke it', method: 'DELETE', path: '/account-access-consents/{{consent_id}}', credentials: 'client', expect: [{ status: 204 }] },
				{ kind: 'request', name: 'Read it again', method: 'GET', path: '/account-access-consents/{{consent_id}}', credentials: 'client', expect: [{ status: 200 }, { field: '/data/status', equals: 'Revoked' }] }
			]
		}
	},
	{
		test_id: 'DEMO-CONSENT-003',
		title: 'A consent with no permissions is refused',
		kind: 'automated',
		mandatory: true,
		severity: 'medium',
		requirements: ['validate'],
		expected_result: 'The request is refused with status 400.',
		suggested_fix: 'Check that permissions are given before creating a consent.',
		definition: { steps: [{ ...consent, body: { permissions: [] }, expect: [{ status: 400 }] }] }
	},
	{
		test_id: 'DEMO-ACCOUNT-001',
		title: 'Accounts and balances are given in OMR with three decimals',
		kind: 'automated',
		mandatory: true,
		severity: 'high',
		requirements: ['accounts'],
		expected_result: 'The accounts are listed, and a balance is given in OMR with three decimals, with a correlation id on every answer.',
		suggested_fix: 'Give balances in OMR with three decimals, and echo x-fapi-interaction-id.',
		definition: {
			steps: [
				{ kind: 'request', name: 'List the accounts', method: 'GET', path: '/accounts', credentials: 'customer', save: { account_id: 'body:/data/0/account_id' }, expect: [{ status: 200 }, { header: 'x-fapi-interaction-id', present: true }, { schema: '#/components/schemas/Accounts' }] },
				{ kind: 'request', name: 'Read a balance', method: 'GET', path: '/accounts/{{account_id}}/balances', credentials: 'customer', expect: [{ status: 200 }, { schema: '#/components/schemas/Balance' }] }
			]
		}
	},
	{
		test_id: 'DEMO-AUDIT-001',
		title: 'Consent records are kept for audit',
		kind: 'evidence',
		mandatory: true,
		severity: 'medium',
		requirements: ['audit'],
		expected_result: 'A records policy that covers every consent and its changes.',
		evidence_required: 'Your records retention policy, and an example audit record of a consent being revoked.'
	},
	{
		test_id: 'DEMO-SECURITY-001',
		title: 'A named person is responsible for API security',
		kind: 'control',
		mandatory: false,
		severity: 'low',
		requirements: ['security'],
		expected_result: 'A named, accountable person.',
		evidence_required: 'The name and role of the person, and the document that makes them responsible.'
	}
];
