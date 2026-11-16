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
import { inSuiteOrder, parseTestDefinition } from '@obp/shared/conformator';
import type { SystemCredentials } from './credentials';
import { Unreachable, type Send } from './http';
import { ObpError, type EntityRecord, type ObpApi } from './obp';
import { Blocked, runTest, type CheckResult, type TestOutcome } from './steps';
import { planOutcome, SuiteProblem, type OpenIdSuite } from './openid';
import type { CheckStep } from '@obp/shared/conformator';
import { parseOpenApi, schemaChecker, type SchemaCheck } from './schema';

export const RUN = 'conformator_run';
export const RESULT = 'conformator_result';
export const SYSTEM = 'conformator_system';
export const SUITE = 'conformator_suite';
export const TEST = 'conformator_test';

/** Everything a run needs from outside, so tests can replace any of it. */
export interface RunDeps {
	obp: ObpApi;
	centralSpace: string;
	send: Send;
	credentials: (systemId: string) => Promise<SystemCredentials>;
	timeoutMs: number;
	sleep: (ms: number) => Promise<void>;
	newId: () => string;
	now: () => string;
	version: string;
	/** Read a document (the suite's OpenAPI) from a URL, as text. */
	fetchText: (url: string) => Promise<string>;
	/** The OpenID conformance suite, when OPENID_SUITE_URL is set. */
	openIdSuite?: OpenIdSuite | null;
}

/**
 * Run a check step written in code. Today there is one: `openid:plan`, which runs a plan of the OpenID conformance
 * suite (`with: { plan, variant?, modules? }`) against the participant's server, with the configuration the
 * participant gave the runner. What the runner lacks blocks the test on the harness side.
 */
export async function runCheck(step: CheckStep, credentials: SystemCredentials, deps: Pick<RunDeps, 'openIdSuite'>): Promise<CheckResult> {
	if (step.check !== 'openid:plan') return { outcome: 'blocked', blocked_by: 'harness', actual: `The check ${step.check} is not available in this runner.` };
	if (!deps.openIdSuite) return { outcome: 'blocked', blocked_by: 'harness', actual: 'The runner is not connected to the OpenID conformance suite (OPENID_SUITE_URL is not set).' };
	if (credentials.openidConfig === undefined) return { outcome: 'blocked', blocked_by: 'harness', actual: 'The runner has no OpenID conformance suite configuration for this system (openid-config.json).' };
	const plan = typeof step.with?.plan === 'string' ? step.with.plan : '';
	if (!plan) return { outcome: 'blocked', blocked_by: 'harness', actual: 'The check names no plan (with: { "plan": "..." }).' };
	const variant = step.with?.variant && typeof step.with.variant === 'object' ? (step.with.variant as Record<string, string>) : undefined;
	const modules = Array.isArray(step.with?.modules) ? (step.with.modules as unknown[]).map(String) : undefined;
	try {
		const ran = await deps.openIdSuite.runPlan({ plan, variant, modules }, credentials.openidConfig);
		return { ...planOutcome(ran.modules), evidence: { plan, plan_url: ran.planUrl, modules: ran.modules } };
	} catch (err) {
		if (err instanceof SuiteProblem) return { outcome: 'blocked', blocked_by: 'harness', actual: err.message };
		throw err;
	}
}

/** A record's own fields, without its id, for writing it back whole. */
function fieldsOf(entity: string, record: EntityRecord): EntityRecord {
	const { [`${entity}_id`]: _id, ...rest } = record;
	return rest;
}

/** The text of an error, with OBP-API's message where it gave one. */
function messageOf(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/** A list as JSON within a length, leaving out whole items from the end (and saying so) rather than cutting it mid-way. */
export function fitJson(items: unknown[], max: number): string {
	for (let keep = items.length; keep >= 0; keep--) {
		const kept = keep < items.length ? [...items.slice(0, keep), { note: `${items.length - keep} more left out to fit` }] : items;
		const text = JSON.stringify(kept);
		if (text.length <= max) return text;
	}
	return '[]';
}

/** A problem with the run itself, not with one test: the run ends as harness_error, with this as its reason. */
class RunProblem extends Error {}

/**
 * The runner's token as a client of the participant's system: the client credentials grant at the system's token
 * endpoint, with the client id the participant recorded and the secret or certificate the runner holds. A refusal
 * there blocks the test on the participant's side; anything the runner itself lacks blocks it on the harness side.
 */
export async function systemClientToken(system: EntityRecord, credentials: SystemCredentials, deps: Pick<RunDeps, 'send' | 'timeoutMs'>): Promise<string> {
	const clientId = String(system.runner_client_id || credentials.clientId || '');
	if (!clientId) throw new Blocked('The system record has no client id for the runner (runner_client_id), and its secrets.json has none either.', 'participant');
	if (!credentials.clientSecret && !credentials.tls) throw new Blocked('The runner has neither a client secret nor a certificate for this system.', 'harness');
	let endpoint = credentials.tokenEndpoint;
	try {
		if (!endpoint) {
			if (!system.discovery_url) throw new Blocked('The system has no discovery URL, and the runner has no token_endpoint for it.', 'harness');
			const discovery = await deps.send({ method: 'GET', url: String(system.discovery_url), headers: { accept: 'application/json' }, tls: credentials.tls, timeoutMs: deps.timeoutMs });
			endpoint = discovery.status === 200 ? String(JSON.parse(discovery.text)?.token_endpoint ?? '') : '';
			if (!endpoint) throw new Blocked(`The discovery URL ${system.discovery_url} gave no token_endpoint (status ${discovery.status}).`, 'participant');
		}
		const form = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId });
		if (credentials.clientSecret) form.set('client_secret', credentials.clientSecret);
		if (credentials.scope) form.set('scope', credentials.scope);
		const response = await deps.send({
			method: 'POST',
			url: endpoint,
			headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
			body: form.toString(),
			tls: credentials.tls,
			timeoutMs: deps.timeoutMs
		});
		const json = (() => {
			try {
				return JSON.parse(response.text);
			} catch {
				return null;
			}
		})();
		if (response.status !== 200 || typeof json?.access_token !== 'string')
			throw new Blocked(`The token endpoint ${endpoint} refused the runner (status ${response.status}${json?.error ? `, ${json.error}` : ''}).`, 'participant');
		return json.access_token;
	} catch (err) {
		if (err instanceof Blocked) throw err;
		if (err instanceof Unreachable) throw new Blocked(err.message, 'participant');
		if (err instanceof SyntaxError) throw new Blocked(`The discovery URL ${system.discovery_url} did not return JSON.`, 'participant');
		throw err;
	}
}

/** Write a run back whole with changed fields. */
async function updateRun(space: string, run: EntityRecord, changes: EntityRecord, deps: RunDeps): Promise<EntityRecord> {
	const id = String(run[`${RUN}_id`]);
	const next = { ...fieldsOf(RUN, run), ...changes };
	await deps.obp.update(RUN, space, id, next);
	return { ...next, [`${RUN}_id`]: id };
}

/**
 * The schema check for a run: the suite's OpenAPI document, read once. When the suite names none, there is no check;
 * when it cannot be read, every schema check says why, so only the tests that use one are blocked.
 */
export async function suiteSchemaCheck(suite: EntityRecord, deps: Pick<RunDeps, 'fetchText'>): Promise<SchemaCheck | undefined> {
	const url = String(suite.openapi_url ?? '').trim();
	if (!url) return undefined;
	let text: string;
	try {
		text = await deps.fetchText(url);
	} catch (err) {
		const reason = `The suite's OpenAPI document at ${url} could not be read: ${messageOf(err)}`;
		return () => ({ cannot: reason });
	}
	const parsed = parseOpenApi(text, url);
	if ('cannot' in parsed) return () => ({ cannot: parsed.cannot });
	return schemaChecker(parsed.document);
}

async function outcomeOf(test: EntityRecord, suite: EntityRecord, system: EntityRecord, credentials: SystemCredentials, clientToken: () => Promise<string>, schemaCheck: SchemaCheck | undefined, deps: RunDeps): Promise<TestOutcome> {
	const empty = { correlation_ids: [], exchanges: [] };
	if (test.kind !== 'automated') return { outcome: 'not_executed', actual: "Waits for the participant's evidence and a reviewer's assessment.", ...empty };
	if (suite.system_role === 'api_consumer')
		return {
			outcome: 'blocked',
			blocked_by: 'harness',
			actual: "Tests of API consumers, which check what OBP-API's sandbox recorded, are not available in this runner yet.",
			...empty
		};
	const parsed = parseTestDefinition(String(test.definition ?? ''));
	if (!parsed.ok) return { outcome: 'blocked', blocked_by: 'harness', actual: `The test's definition has problems: ${parsed.problems.join(' ')}`, ...empty };
	return runTest(parsed.definition, {
		baseUrl: String(system.base_url),
		tls: credentials.tls,
		send: deps.send,
		timeoutMs: deps.timeoutMs,
		clientToken,
		customerToken: credentials.customerAccessToken,
		sleep: deps.sleep,
		newId: deps.newId,
		schemaCheck,
		runCheck: (step) => runCheck(step, credentials, deps)
	});
}

/**
 * Run one queued run in a participant's space: mark it running, run each test of its suite in order against its system,
 * record each result as soon as it is known, then mark the run finished. Anything that stops the run as a whole (its
 * suite or system cannot be read, the runner's credentials are broken, a result cannot be recorded) ends it as
 * harness_error, with the reason.
 */
export async function processRun(space: string, queued: EntityRecord, deps: RunDeps): Promise<'finished' | 'harness_error'> {
	const runId = String(queued[`${RUN}_id`]);
	let run = await updateRun(space, queued, { status: 'running', started_at: deps.now(), runner_version: deps.version }, deps);
	try {
		const [suite, tests, system] = await Promise.all([
			deps.obp.get(SUITE, deps.centralSpace, String(run.suite_id), 'public'),
			deps.obp.list(TEST, deps.centralSpace, 'public'),
			deps.obp.get(SYSTEM, space, String(run.system_id))
		]).catch((err) => {
			throw new RunProblem(`The run's suite, tests or system could not be read: ${messageOf(err)}`);
		});
		if (!suite || !system) throw new RunProblem("The run's suite or system does not exist.");
		if (suite.system_role !== system.system_role)
			throw new RunProblem(`The suite tests an ${suite.system_role}, but the system is an ${system.system_role}.`);
		const credentials = await deps.credentials(String(run.system_id)).catch((err) => {
			throw new RunProblem(`The runner's credentials for this system could not be read: ${messageOf(err)}`);
		});

		const schemaCheck = await suiteSchemaCheck(suite, deps);

		// One client token per run, fetched when a step first needs it. A refusal is remembered, so every test says why.
		let token: Promise<string> | null = null;
		const clientToken = () => (token ??= systemClientToken(system, credentials, deps));

		for (const test of inSuiteOrder(tests.filter((t) => t.suite_id === run.suite_id))) {
			const started_at = deps.now();
			const outcome = await outcomeOf(test, suite, system, credentials, clientToken, schemaCheck, deps);
			await deps.obp
				.create(RESULT, space, {
					run_id: runId,
					test_id: String(test.test_id),
					outcome: outcome.outcome,
					blocked_by: outcome.blocked_by ?? '',
					severity: String(test.severity ?? ''),
					expected: String(test.expected_result ?? ''),
					actual: outcome.actual.slice(0, 4000),
					correlation_ids: JSON.stringify(outcome.correlation_ids),
					exchanges: fitJson(outcome.exchanges, 60000),
					started_at,
					finished_at: deps.now()
				})
				.catch((err) => {
					throw new RunProblem(`The result of ${test.test_id} could not be recorded: ${messageOf(err)}`);
				});
		}
		run = await updateRun(space, run, { status: 'finished', finished_at: deps.now() }, deps);
		return 'finished';
	} catch (err) {
		const problem = err instanceof RunProblem || err instanceof ObpError ? err.message : `The runner failed: ${messageOf(err)}`;
		await updateRun(space, run, { status: 'harness_error', problem, finished_at: deps.now() }, deps).catch(() => {});
		return 'harness_error';
	}
}
