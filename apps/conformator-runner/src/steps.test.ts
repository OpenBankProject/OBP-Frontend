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
import type { TestDefinition } from '@obp/shared/conformator';
import { Blocked, runTest, type TestContext } from './steps';
import { Unreachable, type IncomingResponse, type OutgoingRequest } from './http';

function context(answers: Array<IncomingResponse | Error>, overrides: Partial<TestContext> = {}) {
	const sent: OutgoingRequest[] = [];
	let n = 0;
	const ctx: TestContext = {
		baseUrl: 'https://bank.example/ob/',
		send: async (req) => {
			sent.push(req);
			const answer = answers.shift();
			if (!answer) throw new Error('no answer prepared');
			if (answer instanceof Error) throw answer;
			return answer;
		},
		timeoutMs: 1000,
		clientToken: async () => 'client-token',
		customerToken: 'customer-token',
		sleep: async () => {},
		newId: () => `id-${++n}`,
		...overrides
	};
	return { ctx, sent };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}): IncomingResponse => ({ status, headers, text: JSON.stringify(body) });

const consentFlow: TestDefinition = {
	steps: [
		{ kind: 'request', name: 'Create', method: 'POST', path: '/consents', credentials: 'client', body: { permissions: ['ReadAccountsBasic'] }, save: { consent_id: 'body:/data/consent_id' }, expect: [{ status: 201 }] },
		{ kind: 'wait', name: 'Pause', seconds: 1 },
		{ kind: 'request', name: 'Read', method: 'GET', path: '/consents/{{consent_id}}', credentials: 'customer', expect: [{ status: 200 }, { field: '/data/status', equals: 'Authorised' }] }
	]
};

describe('runTest', () => {
	it('passes when every step does what is expected, using saved values', async () => {
		const { ctx, sent } = context([json(201, { data: { consent_id: 'c1' } }), json(200, { data: { status: 'Authorised' } }, { 'x-fapi-interaction-id': 'bank-1' })]);
		const outcome = await runTest(consentFlow, ctx);
		expect(outcome.outcome).toBe('pass');
		expect(sent[0].url).toBe('https://bank.example/ob/consents');
		expect(sent[0].headers.authorization).toBe('Bearer client-token');
		expect(sent[1].url).toBe('https://bank.example/ob/consents/c1');
		expect(sent[1].headers.authorization).toBe('Bearer customer-token');
		expect(outcome.correlation_ids).toEqual(['id-1', 'id-2', 'bank-1']);
	});

	it('keeps evidence without tokens', async () => {
		const { ctx } = context([json(201, { data: { consent_id: 'c1' } }), json(200, { data: { status: 'Authorised' } })]);
		const outcome = await runTest(consentFlow, ctx);
		expect(JSON.stringify(outcome.exchanges)).not.toContain('client-token');
		expect(JSON.stringify(outcome.exchanges)).toContain('(hidden)');
	});

	it('fails, saying how, when the system answers differently', async () => {
		const { ctx } = context([json(201, { data: { consent_id: 'c1' } }), json(200, { data: { status: 'Rejected' } })]);
		const outcome = await runTest(consentFlow, ctx);
		expect(outcome).toMatchObject({ outcome: 'fail', actual: 'Step 3 (Read): Expected /data/status to be "Authorised", got "Rejected".' });
	});

	it('fails when a value to keep is missing', async () => {
		const { ctx } = context([json(201, { data: {} })]);
		expect((await runTest(consentFlow, ctx)).actual).toBe('Step 1 (Create): the response has no body /data/consent_id to keep as consent_id.');
	});

	it('is blocked on the participant side when their system cannot be reached', async () => {
		const { ctx } = context([new Unreachable('bank.example could not be reached: ECONNREFUSED')]);
		expect(await runTest(consentFlow, ctx)).toMatchObject({ outcome: 'blocked', blocked_by: 'participant' });
	});

	it('is blocked on the harness side when the runner has no customer token', async () => {
		const { ctx } = context([json(201, { data: { consent_id: 'c1' } })], { customerToken: undefined });
		expect(await runTest(consentFlow, ctx)).toMatchObject({ outcome: 'blocked', blocked_by: 'harness' });
	});

	it('takes the side from a token problem', async () => {
		const { ctx } = context([], { clientToken: async () => Promise.reject(new Blocked('The token endpoint refused the runner.', 'participant')) });
		expect(await runTest(consentFlow, ctx)).toMatchObject({ outcome: 'blocked', blocked_by: 'participant', actual: 'Step 1 (Create): The token endpoint refused the runner.' });
	});

	it('goes on after a check that passes, and stops at one that fails', async () => {
		const definition: TestDefinition = {
			steps: [
				{ kind: 'check', name: 'FAPI', check: 'openid:plan', with: { plan: 'p' } },
				{ kind: 'request', name: 'Get', method: 'GET', path: '/a', credentials: 'none', expect: [{ status: 200 }] }
			]
		};
		const passing = context([json(200, {})], { runCheck: async () => ({ outcome: 'pass', actual: 'Passed 3 modules.', evidence: { plan_url: 'u' } }) });
		const passed = await runTest(definition, passing.ctx);
		expect(passed.outcome).toBe('pass');
		expect(passed.exchanges[0]).toMatchObject({ check: 'openid:plan', evidence: { plan_url: 'u' } });

		const failing = context([], { runCheck: async () => ({ outcome: 'fail', actual: 'The suite failed m1.' }) });
		expect(await runTest(definition, failing.ctx)).toMatchObject({ outcome: 'fail', actual: 'Step 1 (FAPI): The suite failed m1.' });
		expect(failing.sent).toEqual([]);
	});

	it('is blocked on the harness side for checks it cannot do yet', async () => {
		const { ctx } = context([]);
		const outcome = await runTest({ steps: [{ kind: 'check', name: 'FAPI', check: 'openid:fapi2-security-profile' }] }, ctx);
		expect(outcome).toMatchObject({ outcome: 'blocked', blocked_by: 'harness' });
	});

	it('checks a body against the suite schema, failing with where it does not fit', async () => {
		const { ctx } = context([json(200, { data: { status: 'Odd' } })], { schemaCheck: () => ({ problems: ['/data/status: not one of the allowed values'] }) });
		const outcome = await runTest({ steps: [{ kind: 'request', name: 'Get', method: 'GET', path: '/a', credentials: 'none', expect: [{ schema: '#/components/schemas/Consent' }] }] }, ctx);
		expect(outcome).toMatchObject({ outcome: 'fail', actual: 'Step 1 (Get): Expected the body to match #/components/schemas/Consent: /data/status: not one of the allowed values.' });
	});

	it('fails rather than blocks when a real expectation is missed beside an unsupported one', async () => {
		const { ctx } = context([json(500, {})]);
		const outcome = await runTest(
			{ steps: [{ kind: 'request', name: 'Get', method: 'GET', path: '/a', credentials: 'none', expect: [{ status: 200 }, { schema: 'X' }] }] },
			ctx
		);
		expect(outcome.outcome).toBe('fail');
	});
});
