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
import type { Expectation, Step, TestDefinition } from './definition.js';

/**
 * A test's steps in plain words, for people reading the catalogue: what the runner sends, what it keeps, and what it
 * expects back. Written from the same definition the runner carries out, so the words cannot drift from what it does.
 */

const WHO = { none: 'without credentials', client: "as the runner's own client of the system", customer: 'on behalf of a test customer' } as const;

/** A JSON pointer as readers know it: /data/status becomes data.status, /data/0/account_id becomes data[0].account_id. */
export function pointerWords(pointer: string): string {
	const parts = pointer.replace(/^\//, '').split('/').filter(Boolean);
	return parts.reduce((out, part) => (/^\d+$/.test(part) ? `${out}[${part}]` : out ? `${out}.${part}` : part), '') || 'the whole body';
}

function expectationWords(e: Expectation): string {
	if ('status' in e) return `status ${e.status}`;
	if ('schema' in e) return `the body to match ${e.schema.split('/').at(-1)} from the suite's OpenAPI document`;
	if ('field' in e) return `${pointerWords(e.field)} to be ${JSON.stringify(e.equals)}`;
	return e.present ? `the header ${e.header}` : `no ${e.header} header`;
}

function saveWords(source: string): string {
	return source.startsWith('header:') ? `the ${source.slice('header:'.length)} header` : pointerWords(source.slice('body:'.length));
}

/** One step as a sentence or two. */
export function describeStep(step: Step): string {
	switch (step.kind) {
		case 'wait':
			return `Wait ${step.seconds} second${step.seconds === 1 ? '' : 's'}.`;
		case 'check': {
			if (step.check === 'openid:plan') {
				const plan = typeof step.with?.plan === 'string' ? step.with.plan : 'a plan';
				const modules = Array.isArray(step.with?.modules) ? ` (only ${(step.with!.modules as unknown[]).join(', ')})` : '';
				return `Run the OpenID conformance suite's plan ${plan}${modules} against the system's authorisation server.`;
			}
			return `Run the check ${step.check}.`;
		}
		case 'request': {
			// A value kept by an earlier step reads as <name> in a path.
			const path = step.path.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, '<$1>');
			const parts = [`Send ${step.method} ${path} ${WHO[step.credentials]}`];
			if (step.body !== undefined) parts[0] += `, with the body ${JSON.stringify(step.body)}`;
			parts[0] += '.';
			const expect = step.expect ?? [];
			if (expect.length) parts.push(`Expect ${expect.map(expectationWords).join(', ')}.`);
			const save = Object.entries(step.save ?? {});
			if (save.length) parts.push(`Keep ${save.map(([name, source]) => `${saveWords(source)} as ${name}`).join(' and ')} for later steps.`);
			return parts.join(' ');
		}
	}
}

/** Every step of a definition, in order. */
export function describeDefinition(definition: TestDefinition): string[] {
	return definition.steps.map(describeStep);
}
