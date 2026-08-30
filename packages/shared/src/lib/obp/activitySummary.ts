/**
 * Activity Summary — pure window/delta logic for the API Manager dashboard.
 *
 * Every window derives from ONE snapped "as of" instant so OBP's
 * query-string-keyed cache hits: aggregate-metrics results whose from_date is
 * older than the stable boundary (OBP prop `MappedMetrics.stable.boundary.seconds`,
 * default 600 s) are cached for 24 h under the exact parameter key. A rolling
 * `to_date=now` would never hit that cache (new key every request), while a
 * snapped to_date inside the last 10 minutes would freeze a possibly incomplete
 * count for a day. Lagging by the stable boundary and flooring to 5-minute
 * marks avoids both: every query covers only stable data and keys rotate every
 * 5 minutes.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Snap granularity for the "as of" instant — how often dashboard figures refresh. */
export const ACTIVITY_SNAP_MS = 5 * MINUTE;
/** Matches OBP `MappedMetrics.stable.boundary.seconds` default (600 s). */
export const ACTIVITY_STABLE_LAG_MS = 10 * MINUTE;

export type ActivityWindowKey = '1h' | '24h' | '7d' | '30d';
export type ActivityCompare = 'same-time-last-week' | 'previous-period';

export interface ActivityWindowDef {
	key: ActivityWindowKey;
	label: string;
	ms: number;
	/**
	 * Granularity-matched comparison: hour/day windows compare to the same
	 * window 7 days earlier (weekly seasonality — Monday 09:00 vs Sunday 09:00
	 * is not a fair comparison), 7d/30d compare to the immediately preceding
	 * period.
	 */
	compare: ActivityCompare;
	compareLabel: string;
}

export const ACTIVITY_WINDOWS: readonly ActivityWindowDef[] = [
	{
		key: '1h',
		label: 'Last hour',
		ms: HOUR,
		compare: 'same-time-last-week',
		compareLabel: 'vs same hour last week'
	},
	{
		key: '24h',
		label: 'Last 24 hours',
		ms: DAY,
		compare: 'same-time-last-week',
		compareLabel: 'vs same day last week'
	},
	{
		key: '7d',
		label: 'Last 7 days',
		ms: 7 * DAY,
		compare: 'previous-period',
		compareLabel: 'vs previous 7 days'
	},
	{
		key: '30d',
		label: 'Last 30 days',
		ms: 30 * DAY,
		compare: 'previous-period',
		compareLabel: 'vs previous 30 days'
	}
] as const;

/** Windows for "created" tiles (new users / new consumers) — hourly resolution adds noise, not signal. */
export const ACTIVITY_CREATED_WINDOW_KEYS: readonly ActivityWindowKey[] = [
	'24h',
	'7d',
	'30d'
] as const;

export function activityWindowDefs(keys: readonly ActivityWindowKey[]): ActivityWindowDef[] {
	return keys.map((key) => {
		const def = ACTIVITY_WINDOWS.find((w) => w.key === key);
		if (!def) {
			throw new Error(`Unknown activity window key: ${key}`);
		}
		return def;
	});
}

export interface ActivityWindow {
	from: Date;
	to: Date;
}

/**
 * The single instant every window hangs off: now, lagged behind the stable
 * boundary, floored to a snap mark. Figures therefore lag 10–15 minutes,
 * which the page states plainly ("As of 14:35 UTC").
 */
export function snapAsOf(now: Date): Date {
	return new Date(
		Math.floor((now.getTime() - ACTIVITY_STABLE_LAG_MS) / ACTIVITY_SNAP_MS) * ACTIVITY_SNAP_MS
	);
}

export function windowFor(asOf: Date, ms: number): ActivityWindow {
	return { from: new Date(asOf.getTime() - ms), to: asOf };
}

/** The reference window: shifted back a week, or by exactly its own length. */
export function comparisonWindowFor(
	window: ActivityWindow,
	compare: ActivityCompare
): ActivityWindow {
	const shift =
		compare === 'same-time-last-week' ? WEEK : window.to.getTime() - window.from.getTime();
	return {
		from: new Date(window.from.getTime() - shift),
		to: new Date(window.to.getTime() - shift)
	};
}

/** OBP date format yyyy-MM-dd'T'HH:mm:ss.SSS'Z' — exactly what toISOString produces. */
export function formatObpDate(date: Date): string {
	return date.toISOString();
}

/** Query string for `GET /management/aggregate-metrics` covering the window. */
export function aggregateMetricsQuery(window: ActivityWindow): URLSearchParams {
	const query = new URLSearchParams();
	query.set('from_date', formatObpDate(window.from));
	query.set('to_date', formatObpDate(window.to));
	return query;
}

/**
 * Oldest instant any tile needs: the 30-day window's previous-period
 * comparison reaches back 60 days from asOf.
 */
export function oldestNeededFrom(asOf: Date): Date {
	return new Date(asOf.getTime() - 60 * DAY);
}

/**
 * Count items whose timestamp falls inside the window. Half-open on the left
 * (from < t <= to) so adjacent windows tile without double-counting a
 * boundary instant. Unparsable timestamps don't count.
 */
export function countCreatedWithin<T>(
	items: readonly T[],
	timestamp: (item: T) => string,
	window: ActivityWindow
): number {
	const fromMs = window.from.getTime();
	const toMs = window.to.getTime();
	let count = 0;
	for (const item of items) {
		const t = Date.parse(timestamp(item));
		if (Number.isFinite(t) && t > fromMs && t <= toMs) {
			count += 1;
		}
	}
	return count;
}

export interface ActivityDelta {
	/** Percent change vs the reference, null when the reference is 0 (no meaningful base). */
	pct: number | null;
	direction: 'up' | 'down' | 'flat';
}

export function computeDelta(current: number, reference: number): ActivityDelta {
	if (reference === 0) {
		return { pct: null, direction: current > 0 ? 'up' : 'flat' };
	}
	const pct = ((current - reference) / reference) * 100;
	return { pct, direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}

/**
 * One row of a dashboard tile: the value for a window plus its comparison.
 * `reference`/`delta` are null when the comparison value could not be fetched.
 */
export interface ActivityWindowRow {
	key: ActivityWindowKey;
	label: string;
	compareLabel: string;
	value: number;
	reference: number | null;
	delta: ActivityDelta | null;
}

export function buildWindowRow(
	def: ActivityWindowDef,
	value: number,
	reference: number | null
): ActivityWindowRow {
	return {
		key: def.key,
		label: def.label,
		compareLabel: def.compareLabel,
		value,
		reference,
		delta: reference === null ? null : computeDelta(value, reference)
	};
}

/**
 * Response of `GET /obp/v6.0.0/management/aggregate-metrics` (a single-element
 * array). The distinct/consent fields exist only on OBP-API builds that include
 * the v6.0.0 distinct-counts change; absent means the backend predates it.
 * `distinct_user_count` counts humans: consent-borne calls are attributed to
 * the granting (on-behalf-of) user via the consent table, not to the consent's
 * technical shadow user.
 */
export interface OBPAggregateMetric {
	count: number;
	average_response_time: number;
	minimum_response_time: number;
	maximum_response_time: number;
	distinct_user_count?: number;
	distinct_consumer_count?: number;
	consent_call_count?: number;
	distinct_consent_count?: number;
}

/** The endpoint returns `[ {…} ]`; tolerate a bare object, reject anything else. */
export function unwrapAggregateMetric(body: unknown): OBPAggregateMetric | null {
	const candidate: unknown = Array.isArray(body) ? body[0] : body;
	if (
		candidate !== null &&
		typeof candidate === 'object' &&
		typeof (candidate as { count?: unknown }).count === 'number'
	) {
		return candidate as OBPAggregateMetric;
	}
	return null;
}
