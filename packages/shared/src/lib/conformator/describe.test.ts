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
import { describeDefinition, describeStep, EXAMPLE_TESTS, pointerWords } from './index.js';

describe('pointerWords', () => {
	it('reads pointers as paths people know', () => {
		expect(pointerWords('/data/status')).toBe('data.status');
		expect(pointerWords('/data/0/account_id')).toBe('data[0].account_id');
		expect(pointerWords('')).toBe('the whole body');
	});
});

describe('describeStep', () => {
	it('says what a request sends, expects and keeps', () => {
		expect(
			describeStep({
				kind: 'request',
				name: 'Create',
				method: 'POST',
				path: '/consents',
				credentials: 'client',
				body: { permissions: ['ReadAccountsBasic'] },
				save: { consent_id: 'body:/data/consent_id' },
				expect: [{ status: 201 }, { field: '/data/status', equals: 'AwaitingAuthorisation' }, { schema: '#/components/schemas/Consent' }, { header: 'x-fapi-interaction-id', present: true }]
			})
		).toBe(
			"Send POST /consents as the runner's own client of the system, with the body {\"permissions\":[\"ReadAccountsBasic\"]}. " +
				'Expect status 201, data.status to be "AwaitingAuthorisation", the body to match Consent from the suite\'s OpenAPI document, the header x-fapi-interaction-id. ' +
				'Keep data.consent_id as consent_id for later steps.'
		);
	});

	it('shows a kept value in a path as <name>', () => {
		expect(describeStep({ kind: 'request', name: 'Read', method: 'GET', path: '/consents/{{consent_id}}', credentials: 'client' })).toBe(
			"Send GET /consents/<consent_id> as the runner's own client of the system."
		);
	});

	it('describes waits and checks', () => {
		expect(describeStep({ kind: 'wait', name: 'w', seconds: 1 })).toBe('Wait 1 second.');
		expect(describeStep({ kind: 'check', name: 'c', check: 'openid:plan', with: { plan: 'fapi2-plan', modules: ['m1'] } })).toBe(
			"Run the OpenID conformance suite's plan fapi2-plan (only m1) against the system's authorisation server."
		);
	});

	it('describes every step of the example suite', () => {
		for (const t of EXAMPLE_TESTS.filter((t) => t.definition)) expect(describeDefinition(t.definition!).length).toBe(t.definition!.steps.length);
	});
});
