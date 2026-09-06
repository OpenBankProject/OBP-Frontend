<!--
  Copyright (C) 2025-2026 TESOBE GmbH
  SPDX-License-Identifier: AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { MY_METRICS_RANGES, MY_METRICS_VERBS } from '@obp/shared/obp';
	import type { OBPMetric } from '@obp/shared/obp';

	let { data } = $props();

	const RANGE_LABELS: Record<keyof typeof MY_METRICS_RANGES, string> = {
		'1h': 'Last hour',
		'24h': 'Last 24 hours',
		'7d': 'Last 7 days',
		'30d': 'Last 30 days'
	};

	function formatDate(dateString: string): string {
		try {
			return new Date(dateString).toLocaleString(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			});
		} catch {
			return dateString;
		}
	}

	function verbClass(verb: string): string {
		switch (verb.toUpperCase()) {
			case 'GET':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
			case 'POST':
				return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
			case 'PUT':
			case 'PATCH':
				return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
			case 'DELETE':
				return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
		}
	}

	function statusClass(status: number): string {
		if (status >= 500) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
		if (status >= 400) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
		if (status >= 300) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
		return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
	}

	function durationClass(ms: number): string {
		if (ms >= 500) return 'text-red-700 dark:text-red-300';
		if (ms >= 100) return 'text-amber-700 dark:text-amber-300';
		return 'text-green-700 dark:text-green-300';
	}

	function endpointLabel(metric: OBPMetric): string {
		return metric.operation_id || metric.implemented_by_partial_function || '—';
	}

	function apiExplorerLink(metric: OBPMetric): string {
		if (!data.apiExplorerUrl || !metric.operation_id) return '';
		return `${data.apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=${encodeURIComponent(metric.operation_id)}`;
	}

	/** Filter this page down to one consent's calls — from a row's "Via consent" chip. */
	function consentFilterHref(consentReferenceId: string): string {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('consent_reference_id', consentReferenceId);
		params.delete('page');
		return `/user/my-activity-dashboard?${params.toString()}`;
	}

	function clearConsentFilterHref(): string {
		const params = new URLSearchParams(page.url.searchParams);
		params.delete('consent_reference_id');
		params.delete('page');
		const qs = params.toString();
		return qs ? `/user/my-activity-dashboard?${qs}` : '/user/my-activity-dashboard';
	}

	/** Same filters, different page — keeps the URL shareable. */
	function pageHref(pageNumber: number): string {
		const params = new URLSearchParams(page.url.searchParams);
		if (pageNumber > 0) params.set('page', String(pageNumber));
		else params.delete('page');
		const qs = params.toString();
		return qs ? `/user/my-activity-dashboard?${qs}` : '/user/my-activity-dashboard';
	}

	function widerRangeHref(): string {
		const params = new URLSearchParams(page.url.searchParams);
		params.set('range', '30d');
		params.delete('page');
		return `/user/my-activity-dashboard?${params.toString()}`;
	}

	/** 1284 → "1,284" in the viewer's locale; keeps tiles proportional, not tabular. */
	function formatCount(n: number): string {
		return n.toLocaleString();
	}

	function formatPercent(fraction: number): string {
		return `${(fraction * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
	}

	function endpointExplorerLink(operationId: string): string {
		if (!data.apiExplorerUrl || !operationId) return '';
		return `${data.apiExplorerUrl}/resource-docs/OBPv6.0.0?operationid=${encodeURIComponent(operationId)}`;
	}

	let summaryErrors = $derived((data.summary?.clientErrors ?? 0) + (data.summary?.serverErrors ?? 0));
	let myConsumerOptions = $derived(data.consumerOptions.filter((c) => c.mine));
	let otherConsumerOptions = $derived(data.consumerOptions.filter((c) => !c.mine));

	let firstIndex = $derived(data.filters.page * data.pageSize + 1);
	let lastIndex = $derived(data.filters.page * data.pageSize + data.metrics.length);
</script>

<svelte:head>
	<title>Activity Dashboard</title>
</svelte:head>

<form
	method="GET"
	action="/user/my-activity-dashboard"
	class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
	data-testid="activity-filter-form"
>
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<label class="block">
			<span class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Time range</span>
			<select name="range" class="select" data-testid="activity-filter-range">
				{#each Object.keys(MY_METRICS_RANGES) as range (range)}
					<option value={range} selected={data.filters.range === range}>
						{RANGE_LABELS[range as keyof typeof MY_METRICS_RANGES]}
					</option>
				{/each}
			</select>
		</label>
		<label class="block">
			<span class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Method</span>
			<select name="verb" class="select" data-testid="activity-filter-verb">
				<option value="" selected={data.filters.verb === ''}>Any</option>
				{#each MY_METRICS_VERBS as verb (verb)}
					<option value={verb} selected={data.filters.verb === verb}>{verb}</option>
				{/each}
			</select>
		</label>
		<label class="block">
			<span class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">URL (exact match)</span>
			<!-- No placeholder: an example path here read as an active filter. Empty means no
			     URL filter; the API matches the typed value against the full path exactly. -->
			<input
				type="text"
				name="url"
				class="input"
				value={data.filters.url}
				data-testid="activity-filter-url"
			/>
		</label>
		<label class="block">
			<span class="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">App</span>
			<select name="consumer_id" class="select" data-testid="activity-filter-consumer">
				<option value="" selected={data.filters.consumer_id === ''}>Any app</option>
				{#if myConsumerOptions.length > 0}
					<optgroup label="My apps">
						{#each myConsumerOptions as c (c.consumer_id)}
							<option value={c.consumer_id} selected={data.filters.consumer_id === c.consumer_id}>
								{c.app_name || c.consumer_id}
							</option>
						{/each}
					</optgroup>
				{/if}
				{#if otherConsumerOptions.length > 0}
					<optgroup label="Other apps calling on my behalf">
						{#each otherConsumerOptions as c (c.consumer_id)}
							<option value={c.consumer_id} selected={data.filters.consumer_id === c.consumer_id}>
								{c.app_name || c.consumer_id}
							</option>
						{/each}
					</optgroup>
				{/if}
			</select>
		</label>
	</div>
	<div class="mt-4 flex items-center gap-3">
		<button type="submit" class="btn preset-filled-primary-500" data-testid="activity-filter-apply">
			Apply
		</button>
		<a href="/user/my-activity-dashboard" class="text-sm underline hover:text-gray-900 dark:hover:text-gray-100" data-testid="activity-filter-clear">
			Clear
		</a>
	</div>
</form>

{#if data.filters.consent_reference_id}
	<p class="mb-4 text-sm text-gray-600 dark:text-gray-400" data-testid="activity-consent-filter">
		Showing only calls made under consent <code>{data.filters.consent_reference_id}</code>
		— <a href={clearConsentFilterHref()} class="underline">show all</a>
		· <a href="/user/consents" class="underline">my consents</a>
	</p>
{/if}

{#if data.error}
	<div class="alert variant-filled-error mb-4" role="alert" data-testid="activity-fetch-error">
		{data.error}
	</div>
{/if}

{#if data.summary && data.summary.total > 0}
	<section
		class="mb-6"
		aria-labelledby="activity-summary-heading"
		data-testid="activity-summary"
		data-truncated={data.summary.truncated}
	>
		<h2 id="activity-summary-heading" class="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
			{RANGE_LABELS[data.filters.range]}
			{#if data.summary.truncated}
				<span class="font-normal">· based on the most recent {formatCount(data.summary.total)} calls</span>
			{/if}
		</h2>
		<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div class="text-xs text-gray-600 dark:text-gray-400">API calls</div>
				<div class="mt-1 text-2xl font-semibold" data-testid="activity-summary-total">
					{formatCount(data.summary.total)}{#if data.summary.truncated}+{/if}
				</div>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div class="text-xs text-gray-600 dark:text-gray-400">Errors</div>
				<div class="mt-1 text-2xl font-semibold" data-testid="activity-summary-errors">
					{formatCount(summaryErrors)}
					<span class="text-base font-normal text-gray-600 dark:text-gray-400">({formatPercent(data.summary.errorRate)})</span>
				</div>
				<div class="mt-1 text-xs text-gray-600 dark:text-gray-400">
					{formatCount(data.summary.clientErrors)} × 4xx · {formatCount(data.summary.serverErrors)} × 5xx
				</div>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div class="text-xs text-gray-600 dark:text-gray-400">Median duration</div>
				<div class="mt-1 text-2xl font-semibold" data-testid="activity-summary-p50">
					{formatCount(data.summary.p50Duration)}
					<span class="text-base font-normal text-gray-600 dark:text-gray-400">ms</span>
				</div>
			</div>
			<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div class="text-xs text-gray-600 dark:text-gray-400">95th percentile duration</div>
				<div class="mt-1 text-2xl font-semibold" data-testid="activity-summary-p95">
					{formatCount(data.summary.p95Duration)}
					<span class="text-base font-normal text-gray-600 dark:text-gray-400">ms</span>
				</div>
				<div class="mt-1 text-xs text-gray-600 dark:text-gray-400">slowest {formatCount(data.summary.maxDuration)} ms</div>
			</div>
		</div>

		{#if data.summary.topEndpoints.length > 0}
			<div
				class="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
				data-testid="activity-summary-top-endpoints"
			>
				<h3 class="text-xs text-gray-600 dark:text-gray-400">Top endpoints</h3>
				<ol class="mt-2 space-y-1 text-sm">
					{#each data.summary.topEndpoints as e (e.label)}
						<li class="flex items-baseline gap-3" data-testid="activity-top-endpoint">
							<span class="w-14 shrink-0 text-right font-semibold">{formatCount(e.count)}</span>
							{#if endpointExplorerLink(e.operation_id)}
								<a
									href={endpointExplorerLink(e.operation_id)}
									target="_blank"
									rel="noopener noreferrer"
									class="text-primary-500 hover:underline dark:text-primary-200"
								>
									<code class="text-xs">{e.label}</code>
								</a>
							{:else}
								<code class="text-xs">{e.label}</code>
							{/if}
						</li>
					{/each}
				</ol>
			</div>
		{/if}
	</section>
{/if}

{#if data.metrics.length === 0}
	{#if !data.error}
		<p class="text-gray-600 dark:text-gray-400" data-testid="activity-empty">
			No API calls found for {RANGE_LABELS[data.filters.range].toLowerCase()}.
			{#if data.filters.range !== '30d'}
				<a href={widerRangeHref()} class="underline hover:text-gray-900 dark:hover:text-gray-100">Try the last 30 days.</a>
			{/if}
		</p>
	{/if}
{:else}
	<ol class="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800" data-testid="activity-list">
		{#each data.metrics as metric, i (metric.correlation_id || `idx-${i}`)}
			<li class="px-4 py-3" data-testid="activity-row" data-correlation-id={metric.correlation_id}>
				<!-- Line 1: when, what, how it went -->
				<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
					<span class="whitespace-nowrap text-gray-600 dark:text-gray-400">{formatDate(metric.date)}</span>
					<span class="rounded-full px-2 py-0.5 text-xs font-semibold {verbClass(metric.verb)}">
						{metric.verb.toUpperCase()}
					</span>
					{#if metric.status_code}
						<span class="rounded-full px-2 py-0.5 text-xs font-semibold {statusClass(metric.status_code)}">
							{metric.status_code}
						</span>
					{/if}
					{#if apiExplorerLink(metric)}
						<a
							href={apiExplorerLink(metric)}
							target="_blank"
							rel="noopener noreferrer"
							class="text-primary-500 hover:underline dark:text-primary-200"
							data-testid="activity-operation-link"
						>
							<code class="text-xs">{endpointLabel(metric)}</code>
						</a>
					{:else}
						<code class="text-xs">{endpointLabel(metric)}</code>
					{/if}
					<span class="ml-auto whitespace-nowrap text-sm {durationClass(metric.duration)}">{metric.duration} ms</span>
				</div>
				<!-- Line 2: the full URL on its own line -->
				<div class="mt-1 overflow-x-auto">
					<code class="whitespace-nowrap text-xs" data-testid="activity-url">{metric.url}</code>
				</div>
				<!-- Line 3: who called it, and the trace id -->
				<div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
					<span>
						App: <span class="text-gray-700 dark:text-gray-300">{metric.app_name || '—'}</span>
						{#if metric.consumer_id}
							<code>({metric.consumer_id})</code>
						{/if}
					</span>
					{#if metric.correlation_id}
						<span>Correlation ID: <code>{metric.correlation_id}</code></span>
					{/if}
					{#if metric.consent_reference_id}
						<span data-testid="activity-consent" data-state="linked">
							Consent:
							<a
								href={consentFilterHref(metric.consent_reference_id)}
								class="text-primary-500 hover:underline dark:text-primary-200"
								><code>{metric.consent_reference_id}</code></a
							>
						</span>
					{:else}
						<span data-testid="activity-consent" data-state="none">
							<!-- auth_type is the scheme OBP recorded at call time; older rows predate it. -->
							Consent: none{#if metric.auth_type}&nbsp;({metric.auth_type}){/if}
						</span>
					{/if}
				</div>
			</li>
		{/each}
	</ol>

	<nav class="mt-4 flex items-center justify-between gap-4" aria-label="Pagination">
		<p class="text-sm text-gray-600 dark:text-gray-400" data-testid="activity-page-summary">
			Showing calls {firstIndex}–{lastIndex} (page {data.filters.page + 1})
		</p>
		<div class="flex gap-2">
			{#if data.filters.page > 0}
				<a href={pageHref(data.filters.page - 1)} class="btn btn-sm preset-tonal" data-testid="activity-prev">
					Previous
				</a>
			{/if}
			{#if data.hasMore}
				<a href={pageHref(data.filters.page + 1)} class="btn btn-sm preset-tonal" data-testid="activity-next">
					Next
				</a>
			{/if}
		</div>
	</nav>
{/if}
