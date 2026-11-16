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
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { send } from './http';
import { openIdSuite, planOutcome, SuiteProblem, type ModuleOutcome } from './openid';

/**
 * A fake of the OpenID conformance suite's REST API, as its own client uses it. Modules behave by name: m-start waits
 * to be started, m-slow answers one long poll with a timeout first, m-lost is forgotten from memory but stored as
 * finished, and the result is the part after the last hyphen (m-pass, m-fail, m-skip, m-review, m-warn).
 */
let server: Server;
let base: string;
const received: { config?: unknown; variant?: string; started: string[] } = { started: [] };

beforeAll(async () => {
	const polled = new Set<string>();
	server = createServer((req, res) => {
		const url = new URL(req.url ?? '/', 'http://x');
		let raw = '';
		req.on('data', (c) => (raw += c));
		req.on('end', () => {
			const reply = (status: number, body: unknown) => {
				res.statusCode = status;
				res.setHeader('content-type', 'application/json');
				res.end(JSON.stringify(body));
			};
			if (req.method === 'POST' && url.pathname === '/api/plan') {
				received.config = JSON.parse(raw || 'null');
				received.variant = url.searchParams.get('variant') ?? undefined;
				if (url.searchParams.get('planName') === 'bad-plan') return reply(400, { error: 'unknown plan' });
				const names = ['m-pass', 'm-start', 'm-slow', 'm-lost', 'm-warn', 'm-skip', 'm-fail'];
				return reply(201, { id: 'plan-1', modules: names.map((testModule) => ({ testModule })) });
			}
			if (req.method === 'POST' && url.pathname === '/api/runner') return reply(201, { id: `id-${url.searchParams.get('test')}` });
			const wait = /^\/api\/runner\/([^/]+)\/wait-state$/.exec(url.pathname);
			if (req.method === 'GET' && wait) {
				const id = wait[1];
				if (id === 'id-m-lost') return reply(404, {});
				if (id === 'id-m-slow' && !polled.has(id)) {
					polled.add(id);
					return reply(200, { timeout: true });
				}
				if (id === 'id-m-start' && !received.started.includes(id)) return reply(200, { state: 'CONFIGURED' });
				return reply(200, { state: 'FINISHED' });
			}
			const start = /^\/api\/runner\/([^/]+)$/.exec(url.pathname);
			if (req.method === 'POST' && start) {
				received.started.push(start[1]);
				return reply(200, {});
			}
			const info = /^\/api\/info\/([^/]+)$/.exec(url.pathname);
			if (req.method === 'GET' && info) {
				const word = info[1].split('-').at(-1);
				const result = { pass: 'PASSED', start: 'PASSED', slow: 'PASSED', lost: 'PASSED', warn: 'WARNING', skip: 'SKIPPED', fail: 'FAILED', review: 'REVIEW' }[word ?? ''];
				return reply(200, { status: 'FINISHED', result });
			}
			reply(404, { error: 'not found' });
		});
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
	server.closeAllConnections();
	server.close();
});

describe('openIdSuite.runPlan', () => {
	it('creates the plan with the configuration and variant, runs every module, starts one that waits, and reads each result', async () => {
		const suite = openIdSuite({ baseUrl: base, moduleTimeoutMs: 5000 }, send);
		const ran = await suite.runPlan({ plan: 'fapi2-security-profile-final-test-plan', variant: { sender_constrain: 'mtls' } }, { server: { discoveryUrl: 'https://bank/.well-known' } });
		expect(received.config).toEqual({ server: { discoveryUrl: 'https://bank/.well-known' } });
		expect(JSON.parse(received.variant!)).toEqual({ sender_constrain: 'mtls' });
		expect(received.started).toEqual(['id-m-start']);
		expect(ran.modules.map((m) => `${m.module}=${m.result}`)).toEqual(['m-pass=PASSED', 'm-start=PASSED', 'm-slow=PASSED', 'm-lost=PASSED', 'm-warn=WARNING', 'm-skip=SKIPPED', 'm-fail=FAILED']);
		expect(ran.planUrl).toBe(`${base}/plan-detail.html?plan=plan-1`);
		expect(ran.modules[0].log_url).toBe(`${base}/log-detail.html?log=id-m-pass`);
	});

	it('runs only the modules asked for', async () => {
		const ran = await openIdSuite({ baseUrl: base, moduleTimeoutMs: 5000 }, send).runPlan({ plan: 'p', modules: ['m-pass', 'm-warn'] }, {});
		expect(ran.modules.map((m) => m.module)).toEqual(['m-pass', 'm-warn']);
	});

	it('reports a refused plan, or a suite it cannot reach, as a suite problem', async () => {
		await expect(openIdSuite({ baseUrl: base, moduleTimeoutMs: 5000 }, send).runPlan({ plan: 'bad-plan' }, {})).rejects.toThrow(/refused to create the plan bad-plan \(400: unknown plan\)/);
		await expect(openIdSuite({ baseUrl: 'http://127.0.0.1:1', moduleTimeoutMs: 5000 }, send).runPlan({ plan: 'p' }, {})).rejects.toBeInstanceOf(SuiteProblem);
	});
});

describe('planOutcome', () => {
	const m = (module: string, result: ModuleOutcome['result'], status = 'FINISHED'): ModuleOutcome => ({ module, id: module, result, status, log_url: '' });

	it('passes when every counted module passed, listing warnings', () => {
		expect(planOutcome([m('a', 'PASSED'), m('b', 'WARNING'), m('c', 'SKIPPED')])).toEqual({ outcome: 'pass', actual: 'The OpenID conformance suite passed 2 modules. Warnings in: b.' });
	});

	it('fails when any module failed', () => {
		expect(planOutcome([m('a', 'PASSED'), m('b', 'FAILED'), m('c', 'REVIEW')])).toMatchObject({ outcome: 'fail', actual: 'The OpenID conformance suite failed b.' });
	});

	it('leaves the test to a reviewer when a module needs review', () => {
		expect(planOutcome([m('a', 'PASSED'), m('c', 'REVIEW')]).outcome).toBe('not_executed');
	});

	it('is blocked on the harness side without a verdict, or when everything was skipped', () => {
		expect(planOutcome([m('a', 'UNKNOWN', 'INTERRUPTED')])).toMatchObject({ outcome: 'blocked', blocked_by: 'harness' });
		expect(planOutcome([m('a', 'SKIPPED')])).toMatchObject({ outcome: 'blocked', actual: 'The OpenID conformance suite skipped every module of the plan.' });
	});
});
