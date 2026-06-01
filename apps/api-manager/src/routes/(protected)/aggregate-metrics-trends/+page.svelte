<script lang="ts">
	type Metric = {
		count: number;
		average_response_time: number;
		minimum_response_time: number;
		maximum_response_time: number;
	};

	type BucketStatus = 'pending' | 'loading' | 'done' | 'error';
	type Bucket = {
		fromDate: Date;
		toDate: Date;
		status: BucketStatus;
		data?: Metric;
		error?: string;
		fromCache?: boolean;
	};

	type Preset = {
		label: string;
		bucketCount: number;
		bucketSizeMs: number;
	};

	const MINUTE = 60 * 1000;
	const HOUR = 60 * MINUTE;
	const DAY = 24 * HOUR;
	const CONCURRENCY = 6;

	// Local cache: past buckets (toDate <= now) are immutable from the API's perspective,
	// so we keep their results in localStorage to skip the network on repeat queries.
	const CACHE_KEY = 'obp-aggregate-metrics-cache-v1';
	const CACHE_TTL_MS = 7 * DAY;

	type CacheEntry = { data: Metric; cachedAt: number };
	type CacheStore = Record<string, CacheEntry>;

	let cacheStore: CacheStore | null = null;
	let cacheClearedMessage = $state<string | undefined>(undefined);

	function bucketCacheKey(b: Bucket): string {
		return `${b.fromDate.toISOString()}|${b.toDate.toISOString()}`;
	}

	function isBucketPast(b: Bucket): boolean {
		return b.toDate.getTime() <= Date.now();
	}

	function getCacheStore(): CacheStore {
		if (cacheStore !== null) return cacheStore;
		if (typeof localStorage === 'undefined') {
			cacheStore = {};
			return cacheStore;
		}
		try {
			const raw = localStorage.getItem(CACHE_KEY);
			cacheStore = raw ? (JSON.parse(raw) as CacheStore) : {};
		} catch {
			cacheStore = {};
		}
		return cacheStore;
	}

	function cacheGet(b: Bucket): Metric | null {
		if (!isBucketPast(b)) return null;
		const entry = getCacheStore()[bucketCacheKey(b)];
		if (!entry) return null;
		if (Date.now() - entry.cachedAt > CACHE_TTL_MS) return null;
		return entry.data;
	}

	function cacheSet(b: Bucket, data: Metric): void {
		if (!isBucketPast(b)) return;
		getCacheStore()[bucketCacheKey(b)] = { data, cachedAt: Date.now() };
	}

	function persistCache(): void {
		if (cacheStore === null) return;
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(CACHE_KEY, JSON.stringify(cacheStore));
		} catch {
			// Quota exceeded or storage disabled — silently ignore.
		}
	}

	function clearLocalCache(): void {
		const count = Object.keys(getCacheStore()).length;
		cacheStore = {};
		if (typeof localStorage !== 'undefined') {
			localStorage.removeItem(CACHE_KEY);
		}
		// Also strip the fromCache flag from already-rendered rows so the UI reflects truth.
		for (const b of buckets) {
			if (b.fromCache) b.fromCache = false;
		}
		refreshBuckets();
		cacheClearedMessage = `Cleared ${count} cached bucket${count === 1 ? '' : 's'}.`;
		setTimeout(() => {
			cacheClearedMessage = undefined;
		}, 3000);
	}

	const presets: Preset[] = [
		{ label: 'Last 48 hours, hourly', bucketCount: 48, bucketSizeMs: HOUR },
		{ label: 'Last 30 days, daily', bucketCount: 30, bucketSizeMs: DAY },
		{ label: 'Last 7 days, hourly', bucketCount: 7 * 24, bucketSizeMs: HOUR },
		{ label: 'Last 24 hours, every 30 minutes', bucketCount: 48, bucketSizeMs: 30 * MINUTE }
	];

	type MetricKey =
		| 'count'
		| 'average_response_time'
		| 'minimum_response_time'
		| 'maximum_response_time';
	const metricKeys: { key: MetricKey; label: string }[] = [
		{ key: 'count', label: 'Count' },
		{ key: 'average_response_time', label: 'Avg response time (ms)' },
		{ key: 'minimum_response_time', label: 'Min response time (ms)' },
		{ key: 'maximum_response_time', label: 'Max response time (ms)' }
	];

	function toLocalInput(d: Date): string {
		const offsetMs = d.getTimezoneOffset() * MINUTE;
		return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
	}

	let bucketSizeMs = $state<number>(HOUR);
	let bucketCount = $state<number>(48);
	let endTimeLocal = $state(toLocalInput(new Date()));
	let selectedMetric = $state<MetricKey>('count');
	let buckets = $state<Bucket[]>([]);
	let isRunning = $state(false);
	let runErrorMessage = $state<string | undefined>(undefined);

	// Snap the requested end time to a stable boundary so repeated queries land on the same
	// bucket edges and the OBP API can cache responses. Daily+ buckets align to UTC noon;
	// hourly+ buckets align to the top of the UTC hour; sub-hour buckets align to the nearest
	// multiple of bucketSizeMs since the Unix epoch.
	function alignEndDate(endDate: Date, sizeMs: number): Date {
		if (sizeMs >= DAY) {
			const d = new Date(endDate);
			d.setUTCHours(12, 0, 0, 0);
			if (d.getTime() > endDate.getTime()) {
				d.setUTCDate(d.getUTCDate() - 1);
			}
			return d;
		}
		if (sizeMs >= HOUR) {
			const d = new Date(endDate);
			d.setUTCMinutes(0, 0, 0);
			return d;
		}
		return new Date(Math.floor(endDate.getTime() / sizeMs) * sizeMs);
	}

	function generateBuckets(endDate: Date, sizeMs: number, count: number): Bucket[] {
		const aligned = alignEndDate(endDate, sizeMs);
		const out: Bucket[] = [];
		for (let i = count - 1; i >= 0; i--) {
			const to = new Date(aligned.getTime() - i * sizeMs);
			const from = new Date(to.getTime() - sizeMs);
			out.push({ fromDate: from, toDate: to, status: 'pending' });
		}
		return out;
	}

	function applyPreset(p: Preset) {
		bucketSizeMs = p.bucketSizeMs;
		bucketCount = p.bucketCount;
	}

	function refreshBuckets() {
		// Force Svelte 5 reactivity for in-place bucket mutation
		buckets = [...buckets];
	}

	async function fetchBucket(bucket: Bucket): Promise<void> {
		const cached = cacheGet(bucket);
		if (cached) {
			bucket.data = cached;
			bucket.status = 'done';
			bucket.fromCache = true;
			refreshBuckets();
			return;
		}
		bucket.status = 'loading';
		refreshBuckets();
		const params = new URLSearchParams({
			from_date: bucket.fromDate.toISOString(),
			to_date: bucket.toDate.toISOString()
		});
		try {
			const res = await fetch(`/backend/aggregate-metrics?${params}`);
			if (!res.ok) {
				bucket.status = 'error';
				bucket.error = `HTTP ${res.status}`;
				return;
			}
			const data = await res.json();
			bucket.data = {
				count: data.count,
				average_response_time: data.average_response_time,
				minimum_response_time: data.minimum_response_time,
				maximum_response_time: data.maximum_response_time
			};
			bucket.status = 'done';
			bucket.fromCache = false;
			cacheSet(bucket, bucket.data);
		} catch (err) {
			bucket.status = 'error';
			bucket.error = err instanceof Error ? err.message : String(err);
		} finally {
			refreshBuckets();
		}
	}

	async function runWithConcurrency(
		items: Bucket[],
		limit: number,
		fn: (b: Bucket) => Promise<void>
	) {
		let index = 0;
		async function worker() {
			while (true) {
				const i = index++;
				if (i >= items.length) return;
				await fn(items[i]);
			}
		}
		await Promise.all(
			Array.from({ length: Math.min(limit, items.length) }, () => worker())
		);
	}

	async function runQuery() {
		if (isRunning) return;
		isRunning = true;
		runErrorMessage = undefined;
		const requested = endTimeLocal ? new Date(endTimeLocal) : new Date();
		// Forbid future end times — clamp to now.
		const endDate = new Date(Math.min(requested.getTime(), Date.now()));
		buckets = generateBuckets(endDate, bucketSizeMs, bucketCount);
		try {
			await runWithConcurrency(buckets, CONCURRENCY, fetchBucket);
		} catch (err) {
			runErrorMessage = err instanceof Error ? err.message : String(err);
		} finally {
			isRunning = false;
			persistCache();
		}
	}

	function csvEscape(value: string | number): string {
		const s = String(value);
		if (/[",\n]/.test(s)) {
			return `"${s.replace(/"/g, '""')}"`;
		}
		return s;
	}

	function downloadCsv() {
		const header = [
			'from_date',
			'to_date',
			'count',
			'average_response_time',
			'minimum_response_time',
			'maximum_response_time',
			'status',
			'from_cache',
			'error'
		];
		const rows = buckets.map((b) => [
			b.fromDate.toISOString(),
			b.toDate.toISOString(),
			b.data ? b.data.count : '',
			b.data ? b.data.average_response_time : '',
			b.data ? b.data.minimum_response_time : '',
			b.data ? b.data.maximum_response_time : '',
			b.status,
			b.fromCache ? 'true' : 'false',
			b.error ?? ''
		]);
		const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		const a = document.createElement('a');
		a.href = url;
		a.download = `aggregate-metrics-trends-${stamp}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	let chartMax = $derived.by(() => {
		const vals = buckets.filter((b) => b.data).map((b) => b.data![selectedMetric]);
		return vals.length ? Math.max(...vals) : 0;
	});
	let doneCount = $derived(buckets.filter((b) => b.status === 'done').length);
	let cachedCount = $derived(buckets.filter((b) => b.fromCache).length);
	let errorCount = $derived(buckets.filter((b) => b.status === 'error').length);
	let totalCount = $derived(buckets.length);

	// Chart layout constants
	const CHART_W = 800;
	const CHART_H = 240;
	const CHART_PAD = 32;
	const CHART_INNER_W = CHART_W - 2 * CHART_PAD;
	const CHART_INNER_H = CHART_H - 2 * CHART_PAD;
	let chartMaxOrOne = $derived(chartMax || 1);

	// Preview of where buckets will actually land after alignment. Future end times are
	// clamped to "now" so the preview matches what runQuery() will actually run.
	let alignedEndPreview = $derived.by(() => {
		const raw = endTimeLocal ? new Date(endTimeLocal) : new Date();
		const clamped = new Date(Math.min(raw.getTime(), Date.now()));
		return alignEndDate(clamped, bucketSizeMs);
	});

	function formatBucketRange(b: Bucket): string {
		return `${b.fromDate.toISOString().slice(0, 16).replace('T', ' ')} → ${b.toDate
			.toISOString()
			.slice(11, 16)}`;
	}
</script>

<svelte:head>
	<title>Aggregate Metrics Over Time - OBP API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-6">
	<h1 class="mb-2 text-3xl font-bold">Aggregate Metrics Over Time</h1>
	<p class="mb-6 text-sm text-gray-600 dark:text-gray-400">
		Call the aggregate-metrics endpoint repeatedly across a sliding window to see how usage and
		latency change over time.
	</p>

	<section class="mb-4">
		<h2 class="mb-2 text-lg font-semibold">Quick presets</h2>
		<div class="flex flex-wrap gap-2" data-testid="preset-buttons">
			{#each presets as p}
				<button
					type="button"
					onclick={() => applyPreset(p)}
					class="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
					data-testid="preset-{p.bucketCount}-{p.bucketSizeMs}"
				>
					{p.label}
				</button>
			{/each}
		</div>
	</section>

	<section class="mb-6">
		<h2 class="mb-2 text-lg font-semibold">Custom window</h2>
		<div class="grid grid-cols-1 gap-3 md:grid-cols-4">
			<label class="flex flex-col text-sm">
				<span class="mb-1 font-medium">Bucket size</span>
				<select
					name="bucket-size"
					bind:value={bucketSizeMs}
					class="rounded border px-2 py-1 dark:border-gray-600 dark:bg-gray-700"
					data-testid="bucket-size"
				>
					<option value={5 * MINUTE}>5 minutes</option>
					<option value={15 * MINUTE}>15 minutes</option>
					<option value={30 * MINUTE}>30 minutes</option>
					<option value={HOUR}>1 hour</option>
					<option value={6 * HOUR}>6 hours</option>
					<option value={DAY}>1 day</option>
					<option value={7 * DAY}>7 days</option>
				</select>
			</label>
			<label class="flex flex-col text-sm">
				<span class="mb-1 font-medium">Number of buckets</span>
				<input
					name="bucket-count"
					type="number"
					min="1"
					max="500"
					bind:value={bucketCount}
					class="rounded border px-2 py-1 dark:border-gray-600 dark:bg-gray-700"
					data-testid="bucket-count"
				/>
			</label>
			<label class="flex flex-col text-sm md:col-span-2">
				<span class="mb-1 font-medium">End time (local)</span>
				<input
					name="end-time"
					type="datetime-local"
					max={toLocalInput(new Date())}
					bind:value={endTimeLocal}
					class="rounded border px-2 py-1 dark:border-gray-600 dark:bg-gray-700"
					data-testid="end-time"
				/>
				<span
					class="mt-1 text-xs text-gray-500 dark:text-gray-400"
					data-testid="aligned-end"
				>
					Aligned to (UTC, for cache reuse): {alignedEndPreview.toISOString().replace('T', ' ').slice(0, 19)}
				</span>
			</label>
		</div>
		<div class="mt-3 flex flex-wrap items-center gap-3">
			<button
				type="button"
				onclick={runQuery}
				disabled={isRunning}
				class="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
				data-testid="run-query"
			>
				{isRunning
					? `Running… ${doneCount + errorCount}/${totalCount}`
					: `Run ${bucketCount} call${bucketCount === 1 ? '' : 's'}`}
			</button>
			<button
				type="button"
				onclick={downloadCsv}
				disabled={buckets.length === 0}
				class="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
				data-testid="export-csv"
			>
				Export CSV
			</button>
			<button
				type="button"
				onclick={clearLocalCache}
				class="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
				data-testid="clear-cache"
			>
				Clear local cache
			</button>
			{#if buckets.length > 0}
				<span class="text-sm text-gray-600 dark:text-gray-400">
					{doneCount} done ({cachedCount} cached) · {errorCount} error · {totalCount -
						doneCount -
						errorCount} pending
				</span>
			{/if}
			{#if cacheClearedMessage}
				<span
					class="text-sm text-purple-600 dark:text-purple-400"
					data-testid="cache-cleared-message"
				>
					{cacheClearedMessage}
				</span>
			{/if}
		</div>
	</section>

	{#if runErrorMessage}
		<div
			class="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
			data-testid="run-error"
		>
			{runErrorMessage}
		</div>
	{/if}

	{#if buckets.length > 0}
		<section class="mb-6">
			<div class="mb-2 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Trend</h2>
				<label class="text-sm">
					Metric:
					<select
						bind:value={selectedMetric}
						class="ml-2 rounded border px-2 py-1 dark:border-gray-600 dark:bg-gray-700"
						data-testid="metric-selector"
					>
						{#each metricKeys as m}
							<option value={m.key}>{m.label}</option>
						{/each}
					</select>
				</label>
			</div>
			<div class="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
				<svg
					viewBox="0 0 {CHART_W} {CHART_H}"
					class="h-auto w-full"
					role="img"
					aria-label="Aggregate metrics trend chart"
					data-testid="trend-chart"
				>
					<line
						x1={CHART_PAD}
						y1={CHART_H - CHART_PAD}
						x2={CHART_W - CHART_PAD}
						y2={CHART_H - CHART_PAD}
						stroke="currentColor"
						stroke-opacity="0.3"
					/>
					<line
						x1={CHART_PAD}
						y1={CHART_PAD}
						x2={CHART_PAD}
						y2={CHART_H - CHART_PAD}
						stroke="currentColor"
						stroke-opacity="0.3"
					/>
					<text
						x={CHART_PAD - 6}
						y={CHART_PAD + 4}
						text-anchor="end"
						font-size="10"
						fill="currentColor"
						opacity="0.7">{chartMaxOrOne.toFixed(0)}</text
					>
					<text
						x={CHART_PAD - 6}
						y={CHART_H - CHART_PAD + 4}
						text-anchor="end"
						font-size="10"
						fill="currentColor"
						opacity="0.7">0</text
					>
					{#each buckets as b, i}
						{@const cx = CHART_PAD + (i + 0.5) * (CHART_INNER_W / buckets.length)}
						{@const barW = Math.max(2, CHART_INNER_W / buckets.length - 2)}
						{#if b.data}
							{@const v = b.data[selectedMetric]}
							{@const y = CHART_H - CHART_PAD - (v / chartMaxOrOne) * CHART_INNER_H}
							<rect
								x={cx - barW / 2}
								{y}
								width={barW}
								height={CHART_H - CHART_PAD - y}
								fill="rgb(34 197 94)"
								opacity="0.85"
								data-testid="bar-{i}"
							>
								<title>{formatBucketRange(b)}: {v.toFixed(2)}</title>
							</rect>
						{:else if b.status === 'error'}
							<rect
								x={cx - barW / 2}
								y={CHART_H - CHART_PAD - 4}
								width={barW}
								height={4}
								fill="rgb(239 68 68)"
								data-testid="bar-{i}"
							>
								<title>{formatBucketRange(b)}: {b.error}</title>
							</rect>
						{:else if b.status === 'loading'}
							<rect
								x={cx - barW / 2}
								y={CHART_H - CHART_PAD - 4}
								width={barW}
								height={4}
								fill="currentColor"
								opacity="0.3"
								data-testid="bar-{i}"
							/>
						{/if}
					{/each}
				</svg>
				<div class="mt-2 flex justify-between text-xs text-gray-500 dark:text-gray-400">
					<span>{buckets[0].fromDate.toLocaleString()}</span>
					<span>{buckets[buckets.length - 1].toDate.toLocaleString()}</span>
				</div>
			</div>
		</section>

		<section>
			<h2 class="mb-2 text-lg font-semibold">Buckets</h2>
			<div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
				<table class="min-w-full text-sm" data-testid="buckets-table">
					<thead class="bg-gray-50 dark:bg-gray-800">
						<tr>
							<th class="px-3 py-2 text-left">From (UTC)</th>
							<th class="px-3 py-2 text-left">To (UTC)</th>
							<th class="px-3 py-2 text-right">Count</th>
							<th class="px-3 py-2 text-right">Avg (ms)</th>
							<th class="px-3 py-2 text-right">Min (ms)</th>
							<th class="px-3 py-2 text-right">Max (ms)</th>
							<th class="px-3 py-2 text-left">Status</th>
						</tr>
					</thead>
					<tbody>
						{#each buckets as b, i}
							<tr
								class="border-t border-gray-200 dark:border-gray-700"
								data-testid="bucket-row-{i}"
								data-state={b.status}
							>
								<td class="px-3 py-1 font-mono text-xs"
									>{b.fromDate.toISOString().slice(0, 16).replace('T', ' ')}</td
								>
								<td class="px-3 py-1 font-mono text-xs"
									>{b.toDate.toISOString().slice(0, 16).replace('T', ' ')}</td
								>
								<td class="px-3 py-1 text-right">{b.data ? b.data.count : '—'}</td>
								<td class="px-3 py-1 text-right"
									>{b.data ? b.data.average_response_time.toFixed(1) : '—'}</td
								>
								<td class="px-3 py-1 text-right"
									>{b.data ? b.data.minimum_response_time.toFixed(1) : '—'}</td
								>
								<td class="px-3 py-1 text-right"
									>{b.data ? b.data.maximum_response_time.toFixed(1) : '—'}</td
								>
								<td class="px-3 py-1">
									{#if b.status === 'done'}
										{#if b.fromCache}
											<span
												class="text-purple-600 dark:text-purple-400"
												title="Served from browser localStorage"
											>cached</span>
										{:else}
											<span class="text-green-600 dark:text-green-400">done</span>
										{/if}
									{:else if b.status === 'error'}
										<span class="text-red-600 dark:text-red-400" title={b.error}>error</span>
									{:else if b.status === 'loading'}
										<span class="text-blue-600 dark:text-blue-400">loading…</span>
									{:else}
										<span class="text-gray-500">pending</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/if}
</div>
