import { describe, it, expect } from 'vitest';
import {
	buildMyMetricsQuery,
	buildMyMetricsSummaryQuery,
	summariseMetrics,
	buildMyMetricsConsumerOptions,
	MY_METRICS_PAGE_SIZE,
	MY_METRICS_RANGES,
	MY_METRICS_SUMMARY_LIMIT
} from './metrics.js';
import type { OBPMetric } from './metrics.js';
import type { OBPConsumer } from './types.js';

const NOW = new Date('2026-08-29T12:00:00.000Z');

const build = (qs: string) => buildMyMetricsQuery(new URLSearchParams(qs), NOW);

describe('buildMyMetricsQuery', () => {
	it('quantises from_date to 10-minute marks so the API can cache', () => {
		// 12:07:31.123 floors to 12:00:00.000 before the range is subtracted —
		// a raw "now" would mint a unique cache key on every page load.
		const odd = new Date('2026-08-29T12:07:31.123Z');
		const { query } = buildMyMetricsQuery(new URLSearchParams('range=1h'), odd);
		expect(query.get('from_date')).toBe('2026-08-29T11:00:00.000Z');
	});

	it('always sets from_date, defaulting to the 7-day range', () => {
		const { query, filters } = build('');
		expect(filters.range).toBe('7d');
		expect(query.get('from_date')).toBe(
			new Date(NOW.getTime() - MY_METRICS_RANGES['7d']).toISOString()
		);
		expect(query.has('to_date')).toBe(false);
	});

	it('honours a valid range and ignores an unknown one', () => {
		expect(build('range=1h').query.get('from_date')).toBe('2026-08-29T11:00:00.000Z');
		expect(build('range=30d').filters.range).toBe('30d');
		expect(build('range=1y').filters.range).toBe('7d');
	});

	it('fixes limit, sort and direction', () => {
		const { query } = build('limit=1000&sort_by=duration&direction=asc');
		expect(query.get('limit')).toBe(String(MY_METRICS_PAGE_SIZE));
		expect(query.get('sort_by')).toBe('date');
		expect(query.get('direction')).toBe('desc');
	});

	it('maps page to offset', () => {
		expect(build('').query.get('offset')).toBe('0');
		expect(build('page=2').query.get('offset')).toBe(String(2 * MY_METRICS_PAGE_SIZE));
		expect(build('page=-1').filters.page).toBe(0);
		expect(build('page=abc').filters.page).toBe(0);
	});

	it('drops identity filters the endpoint rejects', () => {
		const { query } = build('user_id=u1&username=bob&email=a@b.c&provider_provider_id=x&anon=true');
		for (const key of ['user_id', 'username', 'email', 'provider_provider_id', 'anon']) {
			expect(query.has(key)).toBe(false);
		}
	});

	it('forwards whitelisted filters, trimmed, only when non-empty', () => {
		const { query, filters } = build(
			'url=%20/obp/v7.0.0/banks%20&app_name=&consumer_id=c1&correlation_id=abc'
		);
		expect(query.get('url')).toBe('/obp/v7.0.0/banks');
		expect(query.has('app_name')).toBe(false);
		expect(query.get('consumer_id')).toBe('c1');
		expect(query.get('correlation_id')).toBe('abc');
		expect(filters.url).toBe('/obp/v7.0.0/banks');
	});

	it('normalises verb and rejects unknown verbs', () => {
		expect(build('verb=get').query.get('verb')).toBe('GET');
		expect(build('verb=OPTIONS').query.has('verb')).toBe(false);
		expect(build('verb=OPTIONS').filters.verb).toBe('');
	});

	it('only accepts a whole number of milliseconds for duration', () => {
		expect(build('duration=500').query.get('duration')).toBe('500');
		expect(build('duration=5s').query.has('duration')).toBe(false);
	});
});

describe('buildMyMetricsSummaryQuery', () => {
	it('keeps the filters but widens to the summary limit from offset 0', () => {
		const { query } = build('range=24h&verb=post&consumer_id=c1&page=3');
		const summary = buildMyMetricsSummaryQuery(query);
		expect(summary.get('limit')).toBe(String(MY_METRICS_SUMMARY_LIMIT));
		expect(summary.get('offset')).toBe('0');
		expect(summary.get('from_date')).toBe(query.get('from_date'));
		expect(summary.get('verb')).toBe('POST');
		expect(summary.get('consumer_id')).toBe('c1');
		// The page query itself is untouched.
		expect(query.get('limit')).toBe(String(MY_METRICS_PAGE_SIZE));
		expect(query.get('offset')).toBe(String(3 * MY_METRICS_PAGE_SIZE));
	});
});

const row = (over: Partial<OBPMetric>): OBPMetric => ({
	user_id: 'u1',
	url: '/obp/v7.0.0/banks',
	date: '2026-08-29T10:00:00Z',
	username: 'alice',
	app_name: 'Portal',
	developer_email: '',
	implemented_by_partial_function: 'getBanks',
	implemented_in_version: 'v7.0.0',
	consumer_id: 'c1',
	verb: 'GET',
	correlation_id: 'x',
	duration: 10,
	source_ip: '',
	target_ip: '',
	status_code: 200,
	operation_id: 'OBPv7.0.0-getBanks',
	...over
});

describe('summariseMetrics', () => {
	it('returns zeros for no rows', () => {
		expect(summariseMetrics([])).toEqual({
			total: 0,
			truncated: false,
			clientErrors: 0,
			serverErrors: 0,
			errorRate: 0,
			p50Duration: 0,
			p95Duration: 0,
			maxDuration: 0,
			topEndpoints: [],
			consumersSeen: []
		});
	});

	it('splits errors by class and computes the rate over all rows', () => {
		const s = summariseMetrics([
			row({ status_code: 200 }),
			row({ status_code: 404 }),
			row({ status_code: 401 }),
			row({ status_code: 503 }),
			row({ status_code: undefined })
		]);
		expect(s.total).toBe(5);
		expect(s.clientErrors).toBe(2);
		expect(s.serverErrors).toBe(1);
		expect(s.errorRate).toBeCloseTo(3 / 5);
	});

	it('uses nearest-rank percentiles of duration', () => {
		const rows = [5, 100, 1, 50, 20, 10, 7, 3, 30, 2].map((duration) => row({ duration }));
		const s = summariseMetrics(rows);
		// sorted: 1 2 3 5 7 10 20 30 50 100 → p50 = 5th = 7, p95 = 10th = 100
		expect(s.p50Duration).toBe(7);
		expect(s.p95Duration).toBe(100);
		expect(s.maxDuration).toBe(100);
	});

	it('ranks endpoints by count then name, falling back to the partial function', () => {
		const s = summariseMetrics(
			[
				row({ operation_id: 'OBPv7.0.0-getBanks' }),
				row({ operation_id: 'OBPv7.0.0-getBanks' }),
				row({ operation_id: 'OBPv7.0.0-getBank' }),
				row({ operation_id: '', implemented_by_partial_function: 'getAccounts' }),
				row({ operation_id: '', implemented_by_partial_function: '' })
			],
			3
		);
		// Ties are alphabetical (locale, case-insensitive); the row with no label is dropped.
		expect(s.topEndpoints).toEqual([
			{ label: 'OBPv7.0.0-getBanks', operation_id: 'OBPv7.0.0-getBanks', count: 2 },
			{ label: 'getAccounts', operation_id: '', count: 1 },
			{ label: 'OBPv7.0.0-getBank', operation_id: 'OBPv7.0.0-getBank', count: 1 }
		]);
		expect(summariseMetrics([row({}), row({}), row({})], 1)).toMatchObject({
			topEndpoints: [{ count: 3 }]
		});
	});

	it('lists distinct consumers seen with their app names', () => {
		const s = summariseMetrics([
			row({ consumer_id: 'c1', app_name: 'Portal' }),
			row({ consumer_id: 'c2', app_name: '' }),
			row({ consumer_id: 'c2', app_name: 'Explorer' }),
			row({ consumer_id: '' })
		]);
		expect(s.consumersSeen).toEqual([
			{ consumer_id: 'c2', app_name: 'Explorer', count: 2 },
			{ consumer_id: 'c1', app_name: 'Portal', count: 1 }
		]);
	});

	it('flags truncation when the summary limit was hit', () => {
		const rows = Array.from({ length: MY_METRICS_SUMMARY_LIMIT }, () => row({}));
		expect(summariseMetrics(rows).truncated).toBe(true);
		expect(summariseMetrics(rows.slice(1)).truncated).toBe(false);
	});
});

describe('buildMyMetricsConsumerOptions', () => {
	const mine = (consumer_id: string, app_name: string) => ({ consumer_id, app_name }) as OBPConsumer;

	it('lists my apps first, then others seen, each alphabetical, keeping the selected id', () => {
		const summary = summariseMetrics([
			row({ consumer_id: 'portal', app_name: 'Portal' }),
			row({ consumer_id: 'b', app_name: '' }),
			row({ consumer_id: 'explorer', app_name: 'API Explorer' })
		]);
		expect(buildMyMetricsConsumerOptions([mine('b', 'Beta'), mine('a', 'alpha')], summary, 'zzz')).toEqual([
			{ consumer_id: 'a', app_name: 'alpha', mine: true },
			{ consumer_id: 'b', app_name: 'Beta', mine: true },
			{ consumer_id: 'explorer', app_name: 'API Explorer', mine: false },
			{ consumer_id: 'portal', app_name: 'Portal', mine: false },
			{ consumer_id: 'zzz', app_name: '', mine: false }
		]);
	});

	it('is empty with nothing to show', () => {
		expect(buildMyMetricsConsumerOptions([], null, '')).toEqual([]);
	});
});
