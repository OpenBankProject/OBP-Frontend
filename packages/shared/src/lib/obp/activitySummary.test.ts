/*
 * Copyright (C) 2025-2026 TESOBE GmbH
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
import { describe, it, expect } from 'vitest';
import {
	ACTIVITY_SNAP_MS,
	ACTIVITY_STABLE_LAG_MS,
	ACTIVITY_WINDOWS,
	ACTIVITY_CREATED_WINDOW_KEYS,
	activityWindowDefs,
	snapAsOf,
	windowFor,
	comparisonWindowFor,
	formatObpDate,
	aggregateMetricsQuery,
	oldestNeededFrom,
	countCreatedWithin,
	computeDelta,
	buildWindowRow,
	unwrapAggregateMetric
} from './activitySummary.js';

const DAY = 24 * 60 * 60 * 1000;

describe('snapAsOf', () => {
	it('lags by the stable boundary and floors to a 5-minute mark (UTC)', () => {
		const now = new Date('2026-08-30T12:34:56.789Z');
		// minus 10 min = 12:24:56.789, floored to 12:20:00.000
		expect(snapAsOf(now).toISOString()).toBe('2026-08-30T12:20:00.000Z');
	});

	it('is exact on a snap boundary', () => {
		const now = new Date('2026-08-30T12:25:00.000Z');
		expect(snapAsOf(now).toISOString()).toBe('2026-08-30T12:15:00.000Z');
	});

	it('always lies at least the stable lag in the past', () => {
		const now = new Date('2026-08-30T12:29:59.999Z');
		const asOf = snapAsOf(now);
		expect(now.getTime() - asOf.getTime()).toBeGreaterThanOrEqual(ACTIVITY_STABLE_LAG_MS);
		expect(asOf.getTime() % ACTIVITY_SNAP_MS).toBe(0);
	});
});

describe('windows', () => {
	const asOf = new Date('2026-08-30T12:20:00.000Z');

	it('windowFor spans exactly the requested duration ending at asOf', () => {
		const w = windowFor(asOf, DAY);
		expect(w.to.toISOString()).toBe(asOf.toISOString());
		expect(w.to.getTime() - w.from.getTime()).toBe(DAY);
	});

	it('same-time-last-week shifts both ends by exactly 7 days', () => {
		const w = windowFor(asOf, 60 * 60 * 1000);
		const c = comparisonWindowFor(w, 'same-time-last-week');
		expect(w.from.getTime() - c.from.getTime()).toBe(7 * DAY);
		expect(w.to.getTime() - c.to.getTime()).toBe(7 * DAY);
	});

	it('previous-period abuts the window with the same duration', () => {
		const w = windowFor(asOf, 7 * DAY);
		const c = comparisonWindowFor(w, 'previous-period');
		expect(c.to.getTime()).toBe(w.from.getTime());
		expect(c.to.getTime() - c.from.getTime()).toBe(7 * DAY);
	});

	it('activityWindowDefs resolves keys in order and rejects unknowns', () => {
		expect(activityWindowDefs(ACTIVITY_CREATED_WINDOW_KEYS).map((d) => d.key)).toEqual([
			'24h',
			'7d',
			'30d'
		]);
		expect(ACTIVITY_WINDOWS.map((d) => d.key)).toEqual(['1h', '24h', '7d', '30d']);
		expect(() => activityWindowDefs(['2h' as never])).toThrow();
	});

	it('oldestNeededFrom reaches back 60 days (30d window + its previous period)', () => {
		expect(oldestNeededFrom(asOf).getTime()).toBe(asOf.getTime() - 60 * DAY);
	});
});

describe('aggregateMetricsQuery', () => {
	it('sets from_date and to_date in OBP format', () => {
		const w = windowFor(new Date('2026-08-30T12:20:00.000Z'), DAY);
		const q = aggregateMetricsQuery(w);
		expect(q.get('from_date')).toBe('2026-08-29T12:20:00.000Z');
		expect(q.get('to_date')).toBe('2026-08-30T12:20:00.000Z');
		expect([...q.keys()]).toEqual(['from_date', 'to_date']);
	});

	it('formatObpDate matches yyyy-MM-ddTHH:mm:ss.SSSZ', () => {
		expect(formatObpDate(new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 6)))).toBe(
			'2026-01-02T03:04:05.006Z'
		);
	});
});

describe('countCreatedWithin', () => {
	const window = {
		from: new Date('2026-08-23T12:00:00.000Z'),
		to: new Date('2026-08-30T12:00:00.000Z')
	};
	const item = (created: string) => ({ created });

	it('counts strictly-after from and up to and including to', () => {
		const items = [
			item('2026-08-23T12:00:00.000Z'), // == from → excluded
			item('2026-08-23T12:00:00.001Z'), // just inside
			item('2026-08-30T12:00:00.000Z'), // == to → included
			item('2026-08-30T12:00:00.001Z'), // after to
			item('2026-08-20T00:00:00.000Z') // before window
		];
		expect(countCreatedWithin(items, (i) => i.created, window)).toBe(2);
	});

	it('ignores unparsable timestamps', () => {
		expect(countCreatedWithin([item('not a date'), item('')], (i) => i.created, window)).toBe(0);
	});
});

describe('computeDelta', () => {
	it('is flat with a null pct when both are zero', () => {
		expect(computeDelta(0, 0)).toEqual({ pct: null, direction: 'flat' });
	});

	it('is up with a null pct when rising from zero', () => {
		expect(computeDelta(5, 0)).toEqual({ pct: null, direction: 'up' });
	});

	it('computes signed percentages', () => {
		expect(computeDelta(150, 100)).toEqual({ pct: 50, direction: 'up' });
		expect(computeDelta(75, 100)).toEqual({ pct: -25, direction: 'down' });
		expect(computeDelta(100, 100)).toEqual({ pct: 0, direction: 'flat' });
	});
});

describe('buildWindowRow', () => {
	const def = ACTIVITY_WINDOWS[0];

	it('carries labels and computes the delta', () => {
		const row = buildWindowRow(def, 120, 100);
		expect(row.key).toBe('1h');
		expect(row.compareLabel).toBe('vs same hour last week');
		expect(row.delta).toEqual({ pct: 20, direction: 'up' });
	});

	it('has no delta when the reference is unavailable', () => {
		const row = buildWindowRow(def, 120, null);
		expect(row.reference).toBeNull();
		expect(row.delta).toBeNull();
	});
});

describe('unwrapAggregateMetric', () => {
	const metric = {
		count: 7076,
		average_response_time: 65.21,
		minimum_response_time: 1,
		maximum_response_time: 9039
	};

	it('unwraps the single-element array the endpoint returns', () => {
		expect(unwrapAggregateMetric([metric])).toEqual(metric);
	});

	it('accepts a bare object', () => {
		expect(unwrapAggregateMetric(metric)).toEqual(metric);
	});

	it('rejects shapes without a numeric count', () => {
		expect(unwrapAggregateMetric([])).toBeNull();
		expect(unwrapAggregateMetric(null)).toBeNull();
		expect(unwrapAggregateMetric({ message: 'OBP-20006: ...' })).toBeNull();
	});

	it('keeps the optional v6.0.0 distinct fields when present', () => {
		const withDistinct = { ...metric, distinct_user_count: 41, consent_call_count: 3 };
		expect(unwrapAggregateMetric([withDistinct])?.distinct_user_count).toBe(41);
	});
});
