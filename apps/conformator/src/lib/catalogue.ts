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
import { parseTestDefinition } from '@obp/shared/conformator';

/** Reading the catalogue's records: the order of tests in a suite, and the requirements a test covers. */

/** The requirement ids a test covers, from the JSON list stored in its record. Anything unreadable counts as none. */
export function requirementIdsOf(stored: unknown): string[] {
	if (typeof stored !== 'string' || stored.trim() === '') return [];
	try {
		const value = JSON.parse(stored);
		return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v !== '') : [];
	} catch {
		return [];
	}
}

/** Tests in suite order, shared with the runner. */
export { inSuiteOrder } from '@obp/shared/conformator';

/** Only a draft suite version can change. An approved one is frozen, and a change becomes a new version. */
export function isEditable(suite: { status?: unknown }): boolean {
	return suite.status === 'draft';
}

/**
 * The next version number for a copy of a suite: the minor part goes up by one (1.2.0 to 1.3.0). A version that is not
 * three numbers gets `.1` added, so a copy never has the same version as the suite it came from.
 */
export function nextVersion(version: string): string {
	const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
	return m ? `${m[1]}.${Number(m[2]) + 1}.0` : `${version.trim()}.1`;
}

/**
 * A suggested ID for the next test in a suite: the suite's code and the next number, such as AIS-PROVIDER-003 after
 * AIS-PROVIDER-002. Only the first three groups of the code are used, each cut to 12 characters, so the ID always fits
 * the test ID rule. A code that cannot start an ID gives TEST-001 and so on. Staff can change the suggestion.
 */
export function nextTestId(suiteCode: string, existingIds: string[]): string {
	const groups = String(suiteCode ?? '')
		.toUpperCase()
		.split('-')
		.map((group) => group.replace(/[^A-Z0-9]/g, '').slice(0, 12))
		.filter(Boolean)
		.slice(0, 3);
	const prefix = groups.length && groups[0].length >= 2 ? groups.join('-') : 'TEST';
	const numbers = existingIds
		.map((testId) => (String(testId).startsWith(`${prefix}-`) ? String(testId).slice(prefix.length + 1) : ''))
		.filter((rest) => /^\d+$/.test(rest))
		.map(Number);
	const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
	return `${prefix}-${String(next).padStart(3, '0')}`;
}

/** Where a new suite's endpoints come from, as far as the "Create a suite" form knows it so far. */
export type SuiteSourceHint =
	| { kind: 'obp_version'; standard: string; shortVersion: string; label: string }
	| { kind: 'openapi_dynamic' | 'openapi_url'; title?: string; fileName?: string }
	| { kind: '' };

/** Letters and digits of some words as a suite code: at most three words of ten characters, joined by hyphens. */
function codeOf(words: string): string {
	return words
		.toUpperCase()
		.split(/[^A-Z0-9]+/)
		.filter(Boolean)
		.slice(0, 3)
		.map((word) => word.slice(0, 10))
		.join('-');
}

/** A file name or the last part of an address, without its extension, as words. */
function wordsOfFileName(fileName: string): string {
	const last = fileName.split(/[\\/?#]/).filter(Boolean).at(-1) ?? '';
	return last.replace(/\.(json|ya?ml)$/i, '').replace(/[-_.]+/g, ' ').trim();
}

/**
 * A suggested code and name for a new suite, from where its endpoints come from, so staff can try things out without
 * having to invent them: "OBP-5-1-0" and "Open Bank Project v5.1.0" for a standard OBP implements, the document's
 * title for an OpenAPI file, the file name when it has none. A code already used by another suite gets -2, -3 and so
 * on. Staff can change both.
 */
export function suggestSuite(hint: SuiteSourceHint, existingCodes: string[]): { code: string; name: string } {
	let code = '';
	let name = '';
	if (hint.kind === 'obp_version') {
		code = `${hint.standard} ${hint.shortVersion.replace(/^v/i, '')}`.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
		name = hint.label;
	} else if (hint.kind === 'openapi_dynamic' || hint.kind === 'openapi_url') {
		name = hint.title?.trim() || wordsOfFileName(hint.fileName ?? '');
		code = codeOf(name);
	}
	if (code.length < 2) code = 'MY-SUITE';
	if (!name) name = 'My suite';
	const taken = new Set(existingCodes.map((existing) => String(existing).toUpperCase()));
	let unique = code;
	for (let n = 2; taken.has(unique); n++) unique = `${code.slice(0, 32 - String(n).length - 1)}-${n}`;
	return { code: unique, name: name.slice(0, 255) };
}

/**
 * Why a draft suite cannot be approved yet: it has no tests, an automated test has no valid definition, or tests check
 * schemas but the suite names no OpenAPI document. An approved suite is frozen, so these must be fixed first.
 */
export function approvalProblems(tests: Array<{ test_id?: unknown; kind?: unknown; definition?: unknown }>, suite: { openapi_url?: unknown } = {}): string[] {
	if (tests.length === 0) return ['The suite has no tests.'];
	const problems: string[] = [];
	const usesSchemas = tests.some((t) => typeof t.definition === 'string' && t.definition.includes('"schema"'));
	if (usesSchemas && !String(suite.openapi_url ?? '').trim()) problems.push('Some tests check responses against schemas, but the suite names no OpenAPI document.');
	for (const test of tests) {
		if (test.kind !== 'automated') continue;
		const text = typeof test.definition === 'string' ? test.definition.trim() : '';
		if (text === '') problems.push(`${String(test.test_id)} is automated but has no definition.`);
		else {
			const parsed = parseTestDefinition(text);
			if (!parsed.ok) problems.push(`${String(test.test_id)} has a definition with problems: ${parsed.problems.join(' ')}`);
		}
	}
	return problems;
}
