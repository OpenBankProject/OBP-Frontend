/**
 * API metrics — the per-call log OBP keeps of every REST request.
 *
 * Row shape is MetricsJsonV600, shared by `GET /management/metrics` (v6, role-gated)
 * and `GET /obp/v7.0.0/my/metrics` (no role; always scoped to the caller).
 */
import type { OBPConsumer } from './types.js';

export interface OBPMetric {
	user_id: string;
	url: string;
	date: string;
	username: string;
	app_name: string;
	developer_email: string;
	implemented_by_partial_function: string;
	implemented_in_version: string;
	consumer_id: string;
	verb: string;
	correlation_id: string;
	duration: number;
	source_ip: string;
	target_ip: string;
	response_body?: { code?: number; message?: string } | null;
	status_code?: number;
	operation_id?: string;
	api_instance_id?: string;
	consent_reference_id?: string;
	/** Authentication scheme of the call (Consent / OAuth2 / OAuth1 / DirectLogin / ...).
	 * Absent on rows written before OBP-API recorded it. */
	auth_type?: string;
	certificate_trust?: string;
	certificate_trust_detail?: string;
}

export interface OBPMetricsResponse {
	metrics: OBPMetric[];
}

/** Look-back windows offered by the Activity Dashboard, in milliseconds. */
export const MY_METRICS_RANGES = {
	'1h': 60 * 60 * 1000,
	'24h': 24 * 60 * 60 * 1000,
	'7d': 7 * 24 * 60 * 60 * 1000,
	'30d': 30 * 24 * 60 * 60 * 1000
} as const;

export type MyMetricsRange = keyof typeof MY_METRICS_RANGES;

export const MY_METRICS_DEFAULT_RANGE: MyMetricsRange = '7d';
export const MY_METRICS_PAGE_SIZE = 50;

/**
 * from_date is quantised to this granularity. A millisecond-precision "now"
 * mints a unique query string on every load, so OBP's query-keyed metrics
 * cache (24h TTL once from_date is older than the stable boundary) can never
 * hit. Flooring to 10-minute marks lets repeated loads share a cache entry;
 * the cost is that calls made inside the current 10-minute slot can lag until
 * the key rotates.
 */
export const MY_METRICS_FROM_DATE_SNAP_MS = 10 * 60 * 1000;

export const MY_METRICS_VERBS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
export type MyMetricsVerb = (typeof MY_METRICS_VERBS)[number];

/**
 * Free-text filters `/my/metrics` accepts that we forward as-is (trimmed).
 * Identity filters (`user_id`, `username`, `email`, `provider_provider_id`, `anon`)
 * are deliberately absent: the endpoint rejects them with OBP-10058 because it
 * only ever returns the caller's own rows.
 */
const PASS_THROUGH_FILTERS = [
	'url',
	'app_name',
	'consumer_id',
	'implemented_in_version',
	'implemented_by_partial_function',
	'correlation_id',
	// One consent's calls — the "Via consent" chip on each agent-made row links here.
	'consent_reference_id'
] as const;

export interface MyMetricsFilters {
	range: MyMetricsRange;
	page: number;
	verb: MyMetricsVerb | '';
	url: string;
	app_name: string;
	consumer_id: string;
	implemented_in_version: string;
	implemented_by_partial_function: string;
	correlation_id: string;
	consent_reference_id: string;
	/** Minimum duration in ms (the API returns calls slower than this). */
	duration: string;
}

export interface MyMetricsQuery {
	/** Query string to append to `/obp/v7.0.0/my/metrics?`. */
	query: URLSearchParams;
	/** The normalised filters actually applied, for echoing back into the form. */
	filters: MyMetricsFilters;
}

function isRange(value: string | null): value is MyMetricsRange {
	return value !== null && Object.prototype.hasOwnProperty.call(MY_METRICS_RANGES, value);
}

function isVerb(value: string): value is MyMetricsVerb {
	return (MY_METRICS_VERBS as readonly string[]).includes(value);
}

/**
 * Translate the page's own search params into the query for `GET /my/metrics`.
 *
 * `from_date` is ALWAYS set: if omitted, the API defaults it to a few minutes
 * ago and the page would look empty. Sorting is fixed to newest-first and
 * paging is expressed as `?page=N` (0-based) on our side, `limit`/`offset` on
 * the API side. Anything not whitelisted here is dropped, never forwarded.
 */
export function buildMyMetricsQuery(
	searchParams: URLSearchParams,
	now: Date = new Date()
): MyMetricsQuery {
	const rangeParam = searchParams.get('range');
	const range: MyMetricsRange = isRange(rangeParam) ? rangeParam : MY_METRICS_DEFAULT_RANGE;

	const pageParam = Number.parseInt(searchParams.get('page') ?? '0', 10);
	const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 0;

	const verbParam = (searchParams.get('verb') ?? '').trim().toUpperCase();
	const verb: MyMetricsVerb | '' = isVerb(verbParam) ? verbParam : '';

	const durationParam = (searchParams.get('duration') ?? '').trim();
	const duration = /^\d+$/.test(durationParam) ? durationParam : '';

	const filters: MyMetricsFilters = {
		range,
		page,
		verb,
		url: '',
		app_name: '',
		consumer_id: '',
		implemented_in_version: '',
		implemented_by_partial_function: '',
		correlation_id: '',
		consent_reference_id: '',
		duration
	};
	for (const key of PASS_THROUGH_FILTERS) {
		filters[key] = (searchParams.get(key) ?? '').trim();
	}

	const query = new URLSearchParams();
	const quantisedNow =
		Math.floor(now.getTime() / MY_METRICS_FROM_DATE_SNAP_MS) * MY_METRICS_FROM_DATE_SNAP_MS;
	query.set('from_date', new Date(quantisedNow - MY_METRICS_RANGES[range]).toISOString());
	query.set('limit', String(MY_METRICS_PAGE_SIZE));
	query.set('offset', String(page * MY_METRICS_PAGE_SIZE));
	query.set('sort_by', 'date');
	query.set('direction', 'desc');
	if (verb) query.set('verb', verb);
	if (duration) query.set('duration', duration);
	for (const key of PASS_THROUGH_FILTERS) {
		if (filters[key]) query.set(key, filters[key]);
	}

	return { query, filters };
}

/**
 * How many of the most recent matching calls the Activity Dashboard summary
 * tiles are computed over. `/my/metrics` returns no aggregates, so we fetch a
 * larger window than the visible page and reduce it ourselves.
 */
export const MY_METRICS_SUMMARY_LIMIT = 1000;

/**
 * The summary query for a page query: identical filters and date window, but
 * the first `MY_METRICS_SUMMARY_LIMIT` rows regardless of which page is shown,
 * so the tiles describe the whole filtered set rather than one page of it.
 */
export function buildMyMetricsSummaryQuery(pageQuery: URLSearchParams): URLSearchParams {
	const query = new URLSearchParams(pageQuery);
	query.set('limit', String(MY_METRICS_SUMMARY_LIMIT));
	query.set('offset', '0');
	return query;
}

export interface MyMetricsEndpointCount {
	/** operation_id, falling back to the partial function name. */
	label: string;
	operation_id: string;
	count: number;
}

export interface MyMetricsConsumerSeen {
	consumer_id: string;
	app_name: string;
	count: number;
}

export interface MyMetricsSummary {
	/** Rows the summary was computed over (≤ MY_METRICS_SUMMARY_LIMIT). */
	total: number;
	/** True when `total` hit the limit, so real totals may be higher. */
	truncated: boolean;
	clientErrors: number;
	serverErrors: number;
	/** (4xx + 5xx) / total, 0–1; 0 when there are no rows. */
	errorRate: number;
	/** Nearest-rank percentiles of `duration` in ms; 0 when there are no rows. */
	p50Duration: number;
	p95Duration: number;
	maxDuration: number;
	/** Most-called endpoints, descending, ties broken alphabetically. */
	topEndpoints: MyMetricsEndpointCount[];
	/** Distinct consumers in the rows, by call count descending. */
	consumersSeen: MyMetricsConsumerSeen[];
}

/** Nearest-rank percentile over an ascending-sorted array. */
function percentile(sortedAsc: number[], p: number): number {
	if (sortedAsc.length === 0) return 0;
	const rank = Math.ceil((p / 100) * sortedAsc.length);
	return sortedAsc[Math.min(Math.max(rank, 1), sortedAsc.length) - 1];
}

/**
 * Reduce a batch of metric rows to the headline figures the dashboard shows.
 * Pure and order-independent, so it is safe to call on whatever the API returned.
 */
export function summariseMetrics(metrics: OBPMetric[], topN = 5): MyMetricsSummary {
	const total = metrics.length;
	let clientErrors = 0;
	let serverErrors = 0;
	const durations: number[] = [];
	const endpoints = new Map<string, MyMetricsEndpointCount>();
	const consumers = new Map<string, MyMetricsConsumerSeen>();

	for (const m of metrics) {
		const status = m.status_code ?? 0;
		if (status >= 500) serverErrors++;
		else if (status >= 400) clientErrors++;

		if (Number.isFinite(m.duration)) durations.push(m.duration);

		const label = m.operation_id || m.implemented_by_partial_function || '';
		if (label) {
			const entry = endpoints.get(label) ?? {
				label,
				operation_id: m.operation_id || '',
				count: 0
			};
			entry.count++;
			endpoints.set(label, entry);
		}

		if (m.consumer_id) {
			const entry = consumers.get(m.consumer_id) ?? {
				consumer_id: m.consumer_id,
				app_name: m.app_name || '',
				count: 0
			};
			entry.count++;
			if (!entry.app_name && m.app_name) entry.app_name = m.app_name;
			consumers.set(m.consumer_id, entry);
		}
	}

	durations.sort((a, b) => a - b);
	const byCountThenName = <T extends { count: number }>(key: (t: T) => string) =>
		(a: T, b: T) => b.count - a.count || key(a).localeCompare(key(b));

	return {
		total,
		truncated: total >= MY_METRICS_SUMMARY_LIMIT,
		clientErrors,
		serverErrors,
		errorRate: total === 0 ? 0 : (clientErrors + serverErrors) / total,
		p50Duration: percentile(durations, 50),
		p95Duration: percentile(durations, 95),
		maxDuration: durations.length === 0 ? 0 : durations[durations.length - 1],
		topEndpoints: [...endpoints.values()]
			.sort(byCountThenName((e) => e.label))
			.slice(0, topN),
		consumersSeen: [...consumers.values()].sort(byCountThenName((c) => c.app_name || c.consumer_id))
	};
}

/** One entry of the Activity Dashboard's "App" filter dropdown. */
export interface MyMetricsConsumerOption {
	consumer_id: string;
	app_name: string;
	/** True for consumers the user registered; false for others seen calling on their behalf (e.g. the Portal). */
	mine: boolean;
}

/**
 * Consumers the user registered, plus any other consumer that appears in the
 * summary rows (the Portal itself, API Explorer, a bank's own app...) — those
 * are not "mine" but the user still wants to filter by them. The currently
 * selected id is always kept so the dropdown echoes the URL faithfully.
 * Order: my apps first, then others, each alphabetical by name.
 */
export function buildMyMetricsConsumerOptions(
	mine: OBPConsumer[],
	summary: MyMetricsSummary | null,
	selectedId: string
): MyMetricsConsumerOption[] {
	const byId = new Map<string, MyMetricsConsumerOption>();
	for (const c of mine) {
		if (c.consumer_id) {
			byId.set(c.consumer_id, { consumer_id: c.consumer_id, app_name: c.app_name || '', mine: true });
		}
	}
	for (const seen of summary?.consumersSeen ?? []) {
		const existing = byId.get(seen.consumer_id);
		if (existing) {
			if (!existing.app_name) existing.app_name = seen.app_name;
		} else {
			byId.set(seen.consumer_id, { consumer_id: seen.consumer_id, app_name: seen.app_name, mine: false });
		}
	}
	if (selectedId && !byId.has(selectedId)) {
		byId.set(selectedId, { consumer_id: selectedId, app_name: '', mine: false });
	}
	const name = (o: MyMetricsConsumerOption) => (o.app_name || o.consumer_id).toLowerCase();
	return [...byId.values()].sort(
		(a, b) => Number(b.mine) - Number(a.mine) || name(a).localeCompare(name(b))
	);
}
