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
import type { BlockedBy, CheckStep, Outcome, RequestStep, TestDefinition } from '@obp/shared/conformator';
import { MissingValue, missedExpectations, sanitise, substitute, valueToSave, type SeenResponse } from './checks';
import { Unreachable, type Send, type TlsMaterial } from './http';
import type { SchemaCheck } from './schema';

/** A test that cannot go on, and whose side stopped it. Never a fail: a fail means the system did something wrong. */
export class Blocked extends Error {
	constructor(
		message: string,
		readonly by: BlockedBy
	) {
		super(message);
	}
}

/** What a test needs from the run around it. */
export interface TestContext {
	baseUrl: string;
	tls?: TlsMaterial;
	send: Send;
	timeoutMs: number;
	/** The runner's token as a client of the system. Throws Blocked when it cannot get one. */
	clientToken: () => Promise<string>;
	/** A test customer's token, if the runner has one for this system. */
	customerToken?: string;
	sleep: (ms: number) => Promise<void>;
	newId: () => string;
	/** Checks against the suite's OpenAPI document, when it has one. */
	schemaCheck?: SchemaCheck;
	/** Runs a `check` step written in code, such as openid:plan. Without it, check steps are blocked. */
	runCheck?: (step: CheckStep) => Promise<CheckResult>;
}

/** What a check written in code found. A pass lets the test go on to its next step. */
export interface CheckResult {
	outcome: 'pass' | 'fail' | 'blocked' | 'not_executed';
	blocked_by?: BlockedBy;
	actual: string;
	evidence?: unknown;
}

export interface TestOutcome {
	outcome: Outcome;
	blocked_by?: BlockedBy;
	actual: string;
	correlation_ids: string[];
	/** The requests and responses, cleaned of secrets, as evidence. */
	exchanges: unknown[];
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

async function authorisation(step: RequestStep, ctx: TestContext): Promise<Record<string, string>> {
	if (step.credentials === 'none') return {};
	if (step.credentials === 'client') return { authorization: `Bearer ${await ctx.clientToken()}` };
	if (!ctx.customerToken) throw new Blocked('The runner has no test customer token for this system (customer_access_token in its secrets.json).', 'harness');
	return { authorization: `Bearer ${ctx.customerToken}` };
}

/**
 * Run one test's steps in order, and decide its outcome:
 * - pass: every step did what the test expects;
 * - fail: the system answered, but not as expected (the result says how);
 * - blocked: the test could not go on. On the participant's side when their system could not be reached or would not
 *   give the runner a token; on the harness side when the runner lacks something (such as the suite's OpenAPI
 *   document), or the test uses a check this runner cannot do yet.
 */
export async function runTest(definition: TestDefinition, ctx: TestContext): Promise<TestOutcome> {
	const saved: Record<string, string> = {};
	const correlation_ids: string[] = [];
	const exchanges: unknown[] = [];
	const done = (outcome: Outcome, actual: string, blocked_by?: BlockedBy): TestOutcome => ({ outcome, actual, correlation_ids, exchanges, ...(blocked_by ? { blocked_by } : {}) });

	for (const [index, step] of definition.steps.entries()) {
		const at = `Step ${index + 1} (${step.name})`;
		try {
			if (step.kind === 'wait') {
				await ctx.sleep(step.seconds * 1000);
				continue;
			}
			if (step.kind === 'check') {
				if (!ctx.runCheck) throw new Blocked(`The check ${step.check} is not available in this runner.`, 'harness');
				const checked = await ctx.runCheck(step);
				exchanges.push(sanitise({ step: step.name, check: step.check, evidence: checked.evidence ?? null, actual: checked.actual }));
				if (checked.outcome === 'pass') continue;
				return done(checked.outcome, `${at}: ${checked.actual}`, checked.outcome === 'blocked' ? (checked.blocked_by ?? 'harness') : undefined);
			}

			const interactionId = ctx.newId();
			correlation_ids.push(interactionId);
			const body = step.body === undefined ? undefined : JSON.stringify(substitute(step.body, saved));
			const headers = {
				accept: 'application/json',
				'x-fapi-interaction-id': interactionId,
				...(body !== undefined ? { 'content-type': 'application/json' } : {}),
				...(await authorisation(step, ctx)),
				...Object.fromEntries(Object.entries(substitute(step.headers ?? {}, saved)).map(([k, v]) => [k.toLowerCase(), v]))
			};
			const url = `${ctx.baseUrl.replace(/\/+$/, '')}${substitute(step.path, saved)}`;
			const response = await ctx.send({ method: step.method, url, headers, body, tls: ctx.tls, timeoutMs: ctx.timeoutMs });
			const seen: SeenResponse = { status: response.status, headers: response.headers, json: parseJson(response.text) };
			const answeredId = response.headers['x-fapi-interaction-id'];
			if (answeredId && answeredId !== interactionId) correlation_ids.push(answeredId);
			exchanges.push(
				sanitise({
					step: step.name,
					request: { method: step.method, url, headers, body: body === undefined ? undefined : parseJson(body) ?? body },
					response: { status: response.status, headers: response.headers, body: seen.json ?? response.text }
				})
			);

			const misses = missedExpectations(step.expect ?? [], seen, ctx.schemaCheck);
			const real = misses.filter((m) => !m.unsupported);
			if (real.length) return done('fail', `${at}: ${real.map((m) => m.text).join(' ')}`);
			if (misses.length) throw new Blocked(misses.map((m) => m.text).join(' '), 'harness');
			for (const [name, source] of Object.entries(step.save ?? {})) {
				const value = valueToSave(source, seen);
				if (value === undefined) return done('fail', `${at}: the response has no ${source.replace(':', ' ')} to keep as ${name}.`);
				saved[name] = value;
			}
		} catch (err) {
			if (err instanceof Blocked) return done('blocked', `${at}: ${err.message}`, err.by);
			if (err instanceof Unreachable) return done('blocked', `${at}: ${err.message}`, 'participant');
			if (err instanceof MissingValue) return done('blocked', `${at}: ${err.message}`, 'harness');
			return done('blocked', `${at}: the runner failed: ${err instanceof Error ? err.message : String(err)}`, 'harness');
		}
	}
	return done('pass', 'Every step did what the test expects.');
}
