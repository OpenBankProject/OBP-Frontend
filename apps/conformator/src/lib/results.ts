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
import { OUTCOMES, type Outcome } from '@obp/shared/conformator';

export interface ResultLike {
	test_id?: unknown;
	outcome?: unknown;
}

export interface TestLike {
	test_id?: unknown;
	mandatory?: unknown;
}

export interface RunSummary {
	counts: Record<Outcome, number>;
	/** Mandatory tests that failed, by test ID. Shown before anything else. */
	mandatoryFailed: string[];
	/** Mandatory tests without a pass or fail yet: blocked, not executed, or no result at all. */
	mandatoryOpen: string[];
	/** Passed tests as a share of the tests that apply, rounded down; null when none apply. */
	percentPassed: number | null;
	/** One line that never hides a failed mandatory test. */
	headline: string;
}

/**
 * Summarise a run's results against its suite's tests. A failed mandatory test is always the headline, whatever the
 * share of tests passed, and a test with no result counts as open, never as passed.
 */
export function summarise(results: ResultLike[], tests: TestLike[]): RunSummary {
	const byTest = new Map(results.map((r) => [String(r.test_id), r.outcome as Outcome]));
	const counts = Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;
	for (const r of results) if ((OUTCOMES as readonly unknown[]).includes(r.outcome)) counts[r.outcome as Outcome]++;

	const mandatory = tests.filter((t) => t.mandatory === true).map((t) => String(t.test_id));
	const mandatoryFailed = mandatory.filter((id) => byTest.get(id) === 'fail');
	const mandatoryOpen = mandatory.filter((id) => !['pass', 'fail', 'not_applicable'].includes(byTest.get(id) ?? ''));

	const applicable = tests.filter((t) => byTest.get(String(t.test_id)) !== 'not_applicable').length;
	const percentPassed = applicable ? Math.floor((counts.pass / applicable) * 100) : null;

	const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
	const headline = mandatoryFailed.length
		? `${plural(mandatoryFailed.length, 'mandatory test')} failed.`
		: mandatoryOpen.length
			? `${plural(mandatoryOpen.length, 'mandatory test')} ${mandatoryOpen.length === 1 ? 'has' : 'have'} no pass or fail yet.`
			: 'Every mandatory test passed.';
	return { counts, mandatoryFailed, mandatoryOpen, percentPassed, headline };
}
