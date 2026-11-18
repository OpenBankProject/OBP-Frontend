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
import type { EntityRecord, ObpApi } from './obp';
import type { IncomingResponse, OutgoingRequest } from './http';
import { fitJson, processRun, runCheck, suiteSchemaCheck, systemClientToken, type RunDeps } from './run';
import { SuiteProblem } from './openid';
import { Blocked } from './steps';

const definition = JSON.stringify({ steps: [{ kind: 'request', name: 'Accounts', method: 'GET', path: '/accounts', credentials: 'client', expect: [{ status: 200 }] }] });

/** OBP-API in memory: records by space and entity, and every write made. */
function fakeObp(data: Record<string, Record<string, EntityRecord[]>>) {
	const writes: Array<{ op: string; entity: string; space: string; body: EntityRecord }> = [];
	const rows = (space: string, entity: string) => ((data[space] ??= {})[entity] ??= []);
	const obp: ObpApi = {
		list: async (entity, space) => rows(space, entity),
		get: async (entity, space, id) => rows(space, entity).find((r) => r[`${entity}_id`] === id) as EntityRecord,
		create: async (entity, space, body) => {
			writes.push({ op: 'create', entity, space, body });
			rows(space, entity).push(body);
			return body;
		},
		update: async (entity, space, id, body) => {
			writes.push({ op: 'update', entity, space, body });
			return body;
		},
		declarePlatformApp: async () => 'accepted',
		consumerId: async () => 'runner-consumer'
	};
	return { obp, writes };
}

function deps(obp: ObpApi, answers: IncomingResponse[], overrides: Partial<RunDeps> = {}): RunDeps & { sent: OutgoingRequest[] } {
	const sent: OutgoingRequest[] = [];
	return {
		obp,
		centralSpace: 'conformator',
		send: async (req) => {
			sent.push(req);
			const answer = answers.shift();
			if (!answer) throw new Error('no answer prepared');
			return answer;
		},
		credentials: async () => ({ clientSecret: 'secret', tokenEndpoint: 'https://auth.bank.example/token' }),
		timeoutMs: 1000,
		sleep: async () => {},
		newId: () => 'id',
		now: () => '2026-11-11T12:00:00Z',
		version: '0.1.0',
		fetchText: async () => {
			throw new Error('no document prepared');
		},
		sent,
		...overrides
	};
}

const world = () => ({
	conformator: {
		conformator_suite: [{ conformator_suite_id: 's1', system_role: 'api_provider', status: 'approved' }],
		conformator_test: [
			{ test_id: 'AIS-002', suite_id: 's1', kind: 'evidence', position: 2, severity: 'medium' },
			{ test_id: 'AIS-001', suite_id: 's1', kind: 'automated', position: 1, severity: 'high', definition, expected_result: 'Accounts are listed.' },
			{ test_id: 'OTHER-001', suite_id: 's2', kind: 'automated', position: 1, definition }
		]
	},
	'conformator-bank': {
		conformator_system: [{ conformator_system_id: 'sys1', system_role: 'api_provider', base_url: 'https://bank.example', runner_client_id: 'runner' }]
	}
});

const queued = { conformator_run_id: 'r1', system_id: 'sys1', suite_id: 's1', status: 'queued', trigger: 'person' };
const ok = (body: unknown): IncomingResponse => ({ status: 200, headers: {}, text: JSON.stringify(body) });

describe('processRun', () => {
	it('runs the suite in order, records each result and finishes', async () => {
		const { obp, writes } = fakeObp(world());
		const d = deps(obp, [ok({ access_token: 'tok' }), ok({ data: [] })]);
		expect(await processRun('conformator-bank', queued, d)).toBe('finished');
		expect(writes.map((w) => `${w.op} ${w.entity} ${w.body.status ?? w.body.test_id}`)).toEqual([
			'update conformator_run running',
			'create conformator_result AIS-001',
			'create conformator_result AIS-002',
			'update conformator_run finished'
		]);
		expect(writes[1].body).toMatchObject({ run_id: 'r1', outcome: 'pass', severity: 'high', expected: 'Accounts are listed.' });
		expect(writes[2].body).toMatchObject({ outcome: 'not_executed' });
		expect(writes[0].body).not.toHaveProperty('conformator_run_id');
		expect(d.sent[1].headers.authorization).toBe('Bearer tok');
	});

	it('ends as harness_error when the suite and system do not match', async () => {
		const data = world();
		data['conformator-bank'].conformator_system[0].system_role = 'api_consumer';
		const { obp, writes } = fakeObp(data);
		expect(await processRun('conformator-bank', queued, deps(obp, []))).toBe('harness_error');
		expect(writes.at(-1)?.body).toMatchObject({ status: 'harness_error', problem: 'The suite tests an api_provider, but the system is an api_consumer.' });
	});

	it('ends as harness_error when the credentials cannot be read', async () => {
		const { obp, writes } = fakeObp(world());
		const d = deps(obp, [], { credentials: async () => Promise.reject(new Error('secrets.json is not valid JSON')) });
		expect(await processRun('conformator-bank', queued, d)).toBe('harness_error');
		expect(String(writes.at(-1)?.body.problem)).toMatch(/credentials for this system could not be read/);
	});

	it('records a refused token as blocked on the participant side, not as a fail', async () => {
		const { obp, writes } = fakeObp(world());
		const d = deps(obp, [{ status: 401, headers: {}, text: '{"error":"invalid_client"}' }]);
		expect(await processRun('conformator-bank', queued, d)).toBe('finished');
		expect(writes[1].body).toMatchObject({ test_id: 'AIS-001', outcome: 'blocked', blocked_by: 'participant' });
	});
});

describe('systemClientToken', () => {
	const send = async () => ok({ access_token: 't' });
	it('needs the client id the participant recorded', async () => {
		await expect(systemClientToken({}, { clientSecret: 's', tokenEndpoint: 'x' }, { send, timeoutMs: 1 })).rejects.toMatchObject({ by: 'participant' });
	});

	it('needs a secret or a certificate held by the runner', async () => {
		await expect(systemClientToken({ runner_client_id: 'c' }, { tokenEndpoint: 'x' }, { send, timeoutMs: 1 })).rejects.toBeInstanceOf(Blocked);
		await expect(systemClientToken({ runner_client_id: 'c' }, { tokenEndpoint: 'x' }, { send, timeoutMs: 1 })).rejects.toMatchObject({ by: 'harness' });
	});

	it('finds the token endpoint through discovery', async () => {
		const sent: OutgoingRequest[] = [];
		const answers = [ok({ token_endpoint: 'https://auth/token' }), ok({ access_token: 'from-discovery' })];
		const token = await systemClientToken(
			{ runner_client_id: 'c', discovery_url: 'https://auth/.well-known/openid-configuration' },
			{ clientSecret: 's' },
			{ send: async (r) => (sent.push(r), answers.shift()!), timeoutMs: 1 }
		);
		expect(token).toBe('from-discovery');
		expect(sent[1].url).toBe('https://auth/token');
		expect(sent[1].body).toBe('grant_type=client_credentials&client_id=c&client_secret=s');
	});
});

describe('fitJson', () => {
	it('keeps everything that fits', () => {
		expect(fitJson([1, 2], 100)).toBe('[1,2]');
	});

	it('leaves out whole items from the end, and says so', () => {
		const text = fitJson(['a'.repeat(40), 'b'.repeat(40)], 80);
		expect(JSON.parse(text)).toEqual(['a'.repeat(40), { note: '1 more left out to fit' }]);
	});
});

describe('suiteSchemaCheck', () => {
	const doc = JSON.stringify({ openapi: '3.1.0', components: { schemas: { S: { type: 'object', required: ['a'] } } } });

	it('is absent when the suite names no document', async () => {
		expect(await suiteSchemaCheck({}, { fetchText: async () => doc })).toBeUndefined();
	});

	it('checks against the document the suite names', async () => {
		const check = (await suiteSchemaCheck({ openapi_url: 'https://reg/openapi.json' }, { fetchText: async () => doc }))!;
		expect(check('#/components/schemas/S', { a: 1 })).toEqual({ problems: [] });
		const missing = check('#/components/schemas/S', {});
		expect('problems' in missing && missing.problems.length).toBe(1);
	});

	it('says why on every check when the document cannot be read', async () => {
		const check = (await suiteSchemaCheck({ openapi_url: 'https://reg/openapi.json' }, { fetchText: async () => Promise.reject(new Error('404')) }))!;
		expect(check('#/components/schemas/S', {})).toEqual({ cannot: "The suite's OpenAPI document at https://reg/openapi.json could not be read: 404" });
	});
});

describe('runCheck', () => {
	const step = { kind: 'check' as const, name: 'FAPI', check: 'openid:plan', with: { plan: 'fapi2', variant: { client_auth_type: 'mtls' } } };
	const suite = (modules: Array<{ module: string; result: string }>) => ({
		runPlan: async () => ({ planId: 'p', planUrl: 'https://suite/plan-detail.html?plan=p', modules: modules.map((m) => ({ ...m, id: m.module, status: 'FINISHED', log_url: '' })) })
	});

	it('is blocked on the harness side without the suite, without the participant configuration, or for an unknown check', async () => {
		expect(await runCheck(step, { openidConfig: {} }, { openIdSuite: null })).toMatchObject({ outcome: 'blocked', blocked_by: 'harness', actual: expect.stringMatching(/OPENID_SUITE_URL/) });
		expect(await runCheck(step, {}, { openIdSuite: suite([]) as any })).toMatchObject({ outcome: 'blocked', actual: expect.stringMatching(/openid-config.json/) });
		expect(await runCheck({ ...step, check: 'other:thing' }, {}, { openIdSuite: null })).toMatchObject({ outcome: 'blocked', actual: 'The check other:thing is not available in this runner.' });
	});

	it("gives the plan's outcome, with the plan and its modules as evidence", async () => {
		const outcome = await runCheck(step, { openidConfig: { server: {} } }, { openIdSuite: suite([{ module: 'm1', result: 'PASSED' }, { module: 'm2', result: 'FAILED' }]) as any });
		expect(outcome).toMatchObject({ outcome: 'fail', evidence: { plan: 'fapi2', plan_url: 'https://suite/plan-detail.html?plan=p' } });
	});

	it('turns a suite problem into a harness block', async () => {
		const broken = { runPlan: async () => Promise.reject(new SuiteProblem('The OpenID conformance suite at x could not be reached: refused')) };
		expect(await runCheck(step, { openidConfig: {} }, { openIdSuite: broken as any })).toMatchObject({ outcome: 'blocked', blocked_by: 'harness' });
	});
});
