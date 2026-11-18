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

/**
 * The definition of an automated test: the steps the runner takes, in order. Most tests are only steps, so the
 * regulator can write and change them without a programmer. A `check` step names a check written in code, for what
 * steps cannot say (for example `openid:fapi2-security-profile`, which hands the work to the OpenID conformance suite).
 *
 * Values saved by one step are used in later ones as `{{name}}`, in a path, a header or a body.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Whose credentials a request uses: none, the runner's own client, or a test customer's consent. */
export type Credentials = 'none' | 'client' | 'customer';

/** One thing a response must show. */
export type Expectation =
	| { status: number }
	| { schema: string }
	| { field: string; equals: string | number | boolean | null }
	| { header: string; present: boolean };

export interface RequestStep {
	kind: 'request';
	/** A short name, shown in results. */
	name: string;
	method: HttpMethod;
	/** The path after the system's base URL, starting with `/`. */
	path: string;
	headers?: Record<string, string>;
	body?: unknown;
	credentials: Credentials;
	/** Values to keep for later steps: a name and where to find it (`body:/data/consent_id` or `header:location`). */
	save?: Record<string, string>;
	expect?: Expectation[];
}

export interface WaitStep {
	kind: 'wait';
	name: string;
	/** Up to 300 seconds. */
	seconds: number;
}

export interface CheckStep {
	kind: 'check';
	name: string;
	/** The code check to run, as `<group>:<name>`. */
	check: string;
	with?: Record<string, unknown>;
}

export type Step = RequestStep | WaitStep | CheckStep;

export interface TestDefinition {
	steps: Step[];
}

export type ParseResult = { ok: true; definition: TestDefinition } | { ok: false; problems: string[] };

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const CREDENTIALS: Credentials[] = ['none', 'client', 'customer'];
const MAX_WAIT_SECONDS = 300;
const SAVE_SOURCE = /^(body:\/.*|header:[A-Za-z0-9-]+)$/;
const CHECK_NAME = /^[a-z0-9-]+:[a-z0-9-]+$/;

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectationProblem(e: unknown): string | null {
	if (!isObject(e)) return 'is not an object';
	if ('status' in e) return Number.isInteger(e.status) && (e.status as number) >= 100 && (e.status as number) <= 599 ? null : 'has a status that is not an HTTP status code';
	if ('schema' in e) return typeof e.schema === 'string' && e.schema !== '' ? null : 'has an empty schema';
	if ('field' in e) {
		if (typeof e.field !== 'string' || !e.field.startsWith('/')) return 'has a field that is not a JSON pointer such as /data/status';
		const v = e.equals;
		return v === null || ['string', 'number', 'boolean'].includes(typeof v) ? null : 'has an equals value that is not text, a number, true, false or null';
	}
	if ('header' in e) return typeof e.header === 'string' && typeof e.present === 'boolean' ? null : 'needs a header name and present: true or false';
	return 'is not a status, schema, field or header expectation';
}

function stepProblems(step: unknown, index: number): string[] {
	const at = `Step ${index + 1}`;
	if (!isObject(step)) return [`${at} is not an object.`];
	const problems: string[] = [];
	if (typeof step.name !== 'string' || step.name.trim() === '') problems.push(`${at} has no name.`);
	switch (step.kind) {
		case 'request': {
			if (!METHODS.includes(step.method as HttpMethod)) problems.push(`${at} has a method that is not one of ${METHODS.join(', ')}.`);
			if (typeof step.path !== 'string' || !step.path.startsWith('/')) problems.push(`${at} has a path that does not start with /.`);
			if (!CREDENTIALS.includes(step.credentials as Credentials)) problems.push(`${at} has credentials that are not one of ${CREDENTIALS.join(', ')}.`);
			if (step.headers !== undefined && (!isObject(step.headers) || Object.values(step.headers).some((v) => typeof v !== 'string')))
				problems.push(`${at} has headers that are not all text.`);
			if (step.save !== undefined) {
				if (!isObject(step.save)) problems.push(`${at} has a save that is not an object.`);
				else
					for (const [name, source] of Object.entries(step.save))
						if (typeof source !== 'string' || !SAVE_SOURCE.test(source))
							problems.push(`${at} saves ${name} from "${String(source)}", which is not body:/<pointer> or header:<name>.`);
			}
			if (step.expect !== undefined) {
				if (!Array.isArray(step.expect)) problems.push(`${at} has an expect that is not a list.`);
				else
					step.expect.forEach((e, i) => {
						const problem = expectationProblem(e);
						if (problem) problems.push(`${at}, expectation ${i + 1} ${problem}.`);
					});
			}
			break;
		}
		case 'wait':
			if (typeof step.seconds !== 'number' || step.seconds <= 0 || step.seconds > MAX_WAIT_SECONDS)
				problems.push(`${at} waits for a number of seconds that is not between 1 and ${MAX_WAIT_SECONDS}.`);
			break;
		case 'check':
			if (typeof step.check !== 'string' || !CHECK_NAME.test(step.check)) problems.push(`${at} names a check that is not <group>:<name>, such as openid:fapi2-security-profile.`);
			if (step.with !== undefined && !isObject(step.with)) problems.push(`${at} has a with that is not an object.`);
			break;
		default:
			problems.push(`${at} has a kind that is not request, wait or check.`);
	}
	return problems;
}

/**
 * Read a test definition from its JSON text, as stored in a test record. Lists every problem found, so the author can
 * fix them all at once.
 */
export function parseTestDefinition(text: string): ParseResult {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch (err) {
		return { ok: false, problems: [`The definition is not valid JSON: ${err instanceof Error ? err.message : String(err)}`] };
	}
	if (!isObject(value) || !Array.isArray(value.steps)) return { ok: false, problems: ['The definition needs a list of steps: {"steps": [...]}.'] };
	if (value.steps.length === 0) return { ok: false, problems: ['The definition has no steps.'] };
	const problems = value.steps.flatMap((step, i) => stepProblems(step, i));
	return problems.length ? { ok: false, problems } : { ok: true, definition: value as unknown as TestDefinition };
}

/** The names a step uses as `{{name}}`, so an author can see which must be saved by an earlier step. */
export function placeholdersIn(value: unknown): string[] {
	const found = new Set<string>();
	const walk = (v: unknown) => {
		if (typeof v === 'string') for (const m of v.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)) found.add(m[1]);
		else if (Array.isArray(v)) v.forEach(walk);
		else if (isObject(v)) Object.values(v).forEach(walk);
	};
	walk(value);
	return [...found];
}

/**
 * Problems with the order of steps: a step that uses `{{name}}` before any earlier step saves it. Kept apart from
 * parseTestDefinition because a code check may supply values too, so this is advice, not a rule.
 */
export function unsavedPlaceholders(definition: TestDefinition): string[] {
	const saved = new Set<string>();
	const problems: string[] = [];
	definition.steps.forEach((step, i) => {
		if (step.kind === 'request') {
			for (const name of placeholdersIn([step.path, step.headers, step.body]))
				if (!saved.has(name)) problems.push(`Step ${i + 1} uses {{${name}}} before any step saves it.`);
			for (const name of Object.keys(step.save ?? {})) saved.add(name);
		}
	});
	return problems;
}
