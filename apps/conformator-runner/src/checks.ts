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
import type { Expectation } from '@obp/shared/conformator';
import type { SchemaCheck } from './schema';

/** A value a step uses as {{name}} that no earlier step saved: a fault in the test, not in the participant's system. */
export class MissingValue extends Error {
	constructor(readonly name: string) {
		super(`The test uses {{${name}}}, which no earlier step saved.`);
	}
}

/** Put saved values in place of {{name}}, in text and in every string inside objects and lists. */
export function substitute<T>(value: T, saved: Record<string, string>): T {
	if (typeof value === 'string')
		return value.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_, name: string) => {
			if (!(name in saved)) throw new MissingValue(name);
			return saved[name];
		}) as T;
	if (Array.isArray(value)) return value.map((v) => substitute(v, saved)) as T;
	if (value && typeof value === 'object')
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, substitute(v, saved)])) as T;
	return value;
}

/** The value at a JSON pointer such as /data/consent_id (RFC 6901), or undefined when there is none. */
export function atPointer(document: unknown, pointer: string): unknown {
	if (pointer === '' || pointer === '/') return document;
	let current: any = document;
	for (const raw of pointer.slice(1).split('/')) {
		const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
		if (current === null || typeof current !== 'object' || !(key in current)) return undefined;
		current = current[key];
	}
	return current;
}

/** A response as the checks see it: header names in lower case, and the body parsed when it is JSON. */
export interface SeenResponse {
	status: number;
	headers: Record<string, string>;
	json: unknown;
}

/** One expectation not met, in words. `unsupported` marks a kind of check this runner cannot do yet. */
export interface Miss {
	text: string;
	unsupported?: boolean;
}

/**
 * Check a response against a step's expectations, and say each one it does not meet. Schema expectations need the
 * suite's OpenAPI document; without it they are marked unsupported, with the reason.
 */
export function missedExpectations(expectations: Expectation[], response: SeenResponse, schemaCheck?: SchemaCheck): Miss[] {
	const misses: Miss[] = [];
	for (const e of expectations) {
		if ('status' in e) {
			if (response.status !== e.status) misses.push({ text: `Expected status ${e.status}, got ${response.status}.` });
		} else if ('schema' in e) {
			if (!schemaCheck) {
				misses.push({ text: `The suite names no OpenAPI document, so the body cannot be checked against ${e.schema}.`, unsupported: true });
				continue;
			}
			const outcome = schemaCheck(e.schema, response.json);
			if ('cannot' in outcome) misses.push({ text: outcome.cannot, unsupported: true });
			else if (outcome.problems.length) misses.push({ text: `Expected the body to match ${e.schema}: ${outcome.problems.join('; ')}.` });
		} else if ('field' in e) {
			const actual = atPointer(response.json, e.field);
			if (actual !== e.equals) misses.push({ text: `Expected ${e.field} to be ${JSON.stringify(e.equals)}, got ${actual === undefined ? 'nothing' : JSON.stringify(actual)}.` });
		} else if ('header' in e) {
			const present = e.header.toLowerCase() in response.headers;
			if (present !== e.present) misses.push({ text: e.present ? `Expected the header ${e.header}, which is missing.` : `Expected no ${e.header} header, but it is there.` });
		}
	}
	return misses;
}

/** Find a value to save, from `body:/pointer` or `header:name`. Undefined when the response does not have it. */
export function valueToSave(source: string, response: SeenResponse): string | undefined {
	if (source.startsWith('body:')) {
		const value = atPointer(response.json, source.slice('body:'.length));
		return value === undefined || value === null || typeof value === 'object' ? undefined : String(value);
	}
	if (source.startsWith('header:')) return response.headers[source.slice('header:'.length).toLowerCase()];
	return undefined;
}

const SECRET_KEYS = /^(authorization|access_token|refresh_token|id_token|client_secret|password|code)$/i;
const MAX_BODY = 2000;

/** A copy safe to keep as evidence: secrets masked, long text cut. Data in the sandbox is synthetic, but tokens are real. */
export function sanitise(value: unknown): unknown {
	if (typeof value === 'string') return value.length > MAX_BODY ? `${value.slice(0, MAX_BODY)}... (cut)` : value;
	if (Array.isArray(value)) return value.slice(0, 50).map(sanitise);
	if (value && typeof value === 'object')
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.test(k) ? '(hidden)' : sanitise(v)]));
	return value;
}
