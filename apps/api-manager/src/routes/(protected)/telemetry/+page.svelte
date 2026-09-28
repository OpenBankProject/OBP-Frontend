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
  import type { PageData } from "./$types";
  import { invalidate } from "$app/navigation";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import {
    Activity,
    Cpu,
    Database,
    Gauge,
    Hash,
    Inbox,
    HardDrive,
    Layers,
    Plug,
    RefreshCw,
    ScrollText,
    Server,
    Users,
  } from "@lucide/svelte";
  import {
    formatBytes,
    formatCount,
    formatDuration,
    formatMillis,
    formatShare,
    metricsSearchHref,
    connectorTracesHref,
    summariseBatchWriters,
    summariseMemoize,
    summariseOtherCounters,
    summariseResponseShapes,
    summariseCaches,
    summariseConnectorCalls,
    summariseEndpoints,
    summariseInstance,
    summariseLogging,
    summarisePools,
    summariseRedisCommands,
    type RequestSummary,
  } from "$lib/telemetry/telemetry";
  import {
    TRAFFIC_WINDOWS,
    clientErrorShare,
    formatEstimate,
    penaliseHref,
    type TrafficSources,
  } from "$lib/telemetry/trafficSources";

  let { data }: { data: PageData } = $props();

  const telemetry = $derived(data.telemetry);
  const meters = $derived(telemetry?.meters ?? []);
  const instance = $derived(summariseInstance(meters));
  const pools = $derived(summarisePools(meters));
  const logging = $derived(summariseLogging(meters));
  const endpoints = $derived(summariseEndpoints(meters));
  const connectorCalls = $derived(summariseConnectorCalls(meters));
  const redisCommands = $derived(summariseRedisCommands(meters));
  const caches = $derived(summariseCaches(meters));
  const responseShapes = $derived(summariseResponseShapes(meters));
  const memoized = $derived(summariseMemoize(meters));
  const batchWriters = $derived(summariseBatchWriters(meters));
  const otherCounters = $derived(summariseOtherCounters(meters));
  // Links to the API Metrics page search back from when this Telemetry was fetched.
  const linkTime = $derived(data.fetchedAt ? new Date(data.fetchedAt) : new Date());

  const batchWriterLabels: Record<string, string> = {
    api_metrics: "API Metrics",
    connector_metrics: "Connector Metrics",
  };

  let endpointFilter = $state("");

  // Where traffic is coming from: fetched in the browser, so the window can change without a reload.
  let trafficWindow = $state<number>(5);
  let traffic = $state<TrafficSources | null>(null);
  let trafficForbidden = $state(false);
  let trafficError = $state<string | null>(null);

  async function fetchTraffic() {
    trafficError = null;
    trafficForbidden = false;
    try {
      const response = await fetch(`/proxy/obp/v7.0.0/management/traffic/top-callers?window=${trafficWindow}`);
      if (response.status === 403) {
        trafficForbidden = true;
        traffic = null;
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Failed to fetch traffic sources (${response.status}): ${data.message}`);
      traffic = data;
    } catch (err) {
      trafficError = err instanceof Error ? err.message : "Failed to fetch traffic sources";
      traffic = null;
    }
  }

  $effect(() => {
    if (data.hasRole) {
      trafficWindow; // re-fetch when the window changes
      fetchTraffic();
    }
  });
  let meterFilter = $state("");
  let memoizeFilter = $state("");
  let refreshing = $state(false);

  const filteredEndpoints = $derived(
    endpoints.filter((row) => row.key.toLowerCase().includes(endpointFilter.trim().toLowerCase())),
  );
  const filteredMemoized = $derived(
    memoized.filter((row) => row.cache.toLowerCase().includes(memoizeFilter.trim().toLowerCase())),
  );
  const filteredMeters = $derived(
    meters.filter((meter) => meter.name.startsWith(meterFilter.trim())),
  );

  async function refresh() {
    refreshing = true;
    try {
      await Promise.all([invalidate("app:telemetry"), fetchTraffic()]);
    } finally {
      refreshing = false;
    }
  }

  function formatTags(tags: Record<string, string>): string {
    return Object.entries(tags)
      .map(([key, value]) => `${key}=${value}`)
      .join(", ");
  }

  /** One measurement as a number people can read: whole numbers with separators, others to four significant digits. */
  function formatMeasurement(value: number): string {
    return Number.isInteger(value) ? value.toLocaleString() : Number(value.toPrecision(4)).toLocaleString();
  }

  /** The unit a measurement is in: timers report total_time and max in seconds, and count is always a plain count. */
  function measurementUnit(statistic: string, baseUnit: string | null | undefined): string {
    if (statistic === "count") return "";
    return baseUnit ?? "";
  }

  const tiles = $derived([
    {
      id: "heap-used",
      label: "Heap used",
      value: formatBytes(instance.heapUsedBytes),
      detail: instance.heapMaxBytes === null ? "no maximum set" : `of ${formatBytes(instance.heapMaxBytes)}`,
      icon: HardDrive,
    },
    {
      id: "heap-after-gc",
      label: "Heap in use after GC",
      value: formatShare(instance.heapAfterGc),
      detail: "long-lived objects",
      icon: Layers,
    },
    {
      id: "gc-overhead",
      label: "Time in GC",
      value: formatShare(instance.gcOverhead),
      detail: "of recent CPU time",
      icon: Activity,
    },
    {
      id: "live-threads",
      label: "Live threads",
      value: formatCount(instance.liveThreads),
      detail: `CPU ${formatShare(instance.processCpu)}`,
      icon: Cpu,
    },
    {
      id: "uptime",
      label: "Uptime",
      value: formatDuration(instance.uptimeSeconds),
      detail: "since this instance started",
      icon: Server,
    },
    {
      id: "log-queue",
      label: "Log dispatch queue",
      value: formatCount(logging.queueDepth),
      detail: `${formatCount(logging.dropped)} dropped`,
      icon: ScrollText,
    },
  ]);
</script>

<svelte:head>
  <title>Telemetry - API Manager</title>
</svelte:head>

{#snippet requestTable(rows: RequestSummary[], keyLabel: string, testId: string, showClientErrors: boolean, hrefOf: (row: RequestSummary) => string | null, linkTitle: string)}
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700" data-testid={testId}>
      <thead class="bg-gray-50 dark:bg-gray-900/50">
        <tr>
          <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">{keyLabel}</th>
          <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Calls</th>
          {#if showClientErrors}
            <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">4xx</th>
            <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">5xx</th>
          {:else}
            <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Failed</th>
          {/if}
          <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Mean</th>
          <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Max</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
        {#each rows as row (row.key)}
          {@const href = hrefOf(row)}
          <tr data-testid="{testId}-row" data-key={row.key}>
            <td class="px-4 py-2 font-mono text-xs">
              {#if href}
                <a {href} class="text-blue-700 hover:underline dark:text-blue-400" title={linkTitle} data-testid="{testId}-link">{row.key}</a>
              {:else}
                <span class="text-gray-900 dark:text-gray-100">{row.key}</span>
              {/if}
            </td>
            <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(row.calls)}</td>
            {#if showClientErrors}
              <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(row.clientErrors)}</td>
            {/if}
            <td class="px-4 py-2 text-right {row.failures > 0 ? 'font-semibold text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}">
              {formatCount(row.failures)}
            </td>
            <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatMillis(row.meanMillis)}</td>
            <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatMillis(row.maxMillis)}</td>
          </tr>
        {:else}
          <tr>
            <td colspan={showClientErrors ? 6 : 5} class="px-4 py-4 text-gray-600 dark:text-gray-400">No calls recorded yet.</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/snippet}

<div class="container mx-auto max-w-7xl px-4 py-8" data-testid="telemetry-page">
  <!-- Header -->
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Telemetry</h1>
      <p class="mt-1 text-gray-600 dark:text-gray-400">
        How the OBP-API instance that answered is running: requests, Connector calls, caches, the
        database pool, memory and threads. Figures are since that instance started. Unlike API
        Metrics, Telemetry never records who made a call.
      </p>
    </div>
    {#if data.hasRole}
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        onclick={refresh}
        disabled={refreshing}
        data-testid="telemetry-refresh"
        data-state={refreshing ? "refreshing" : "idle"}
      >
        <RefreshCw class="h-4 w-4 {refreshing ? 'animate-spin' : ''}" />
        Refresh
      </button>
    {/if}
  </div>

  {#if !data.hasRole}
    <MissingRoleAlert roles={["CanGetTelemetry"]} message="You need this role to view Telemetry" />
  {:else if telemetry}
    <!-- The instance that answered -->
    <div
      class="mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 shadow-sm dark:border-gray-700 dark:bg-gray-700 sm:grid-cols-3"
      data-testid="telemetry-instance"
    >
      <div class="bg-white p-4 dark:bg-gray-800">
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Instance</p>
        <code class="mt-1 block break-all text-sm text-gray-900 dark:text-gray-100" data-testid="telemetry-instance-id">
          {telemetry.api_instance_id}
        </code>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400"><code>api_instance_id</code></p>
      </div>
      <div class="bg-white p-4 dark:bg-gray-800">
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Build</p>
        <code class="mt-1 block break-all text-sm text-gray-900 dark:text-gray-100">{telemetry.git_commit}</code>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">git commit</p>
      </div>
      <div class="bg-white p-4 dark:bg-gray-800" data-testid="telemetry-port" data-state={telemetry.port.enabled ? "open" : "closed"}>
        <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Prometheus port</p>
        <p class="mt-1 text-sm text-gray-900 dark:text-gray-100">
          {#if telemetry.port.enabled}
            Open on port {telemetry.port.port}, path <code>{telemetry.port.path}</code>
          {:else}
            Not open
          {/if}
        </p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400" data-testid="telemetry-port-props">
          Set in Props: <code>telemetry.port.enabled</code>, <code>telemetry.port</code>, <code>telemetry.host</code>
        </p>
      </div>
    </div>

    <!-- Tiles -->
    <div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {#each tiles as tile (tile.id)}
        <div
          class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
          data-testid="telemetry-tile"
          data-tile={tile.id}
        >
          <div class="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
            <tile.icon class="h-4 w-4" />
            {tile.label}
          </div>
          <p class="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{tile.value}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400">{tile.detail}</p>
        </div>
      {/each}
    </div>

    <!-- Where traffic is coming from -->
    <section class="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="telemetry-traffic">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 p-4 dark:border-gray-700">
        <div>
          <div class="flex items-center gap-2">
            <Users class="h-5 w-5 text-rose-500" />
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Where traffic is coming from</h2>
          </div>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            The busiest Consumers, client addresses, and callers and endpoints on this instance. Counts are estimates
            (Space-Saving, Metwally, Agrawal and El Abbadi, 2005): ± is the most they can be out.
          </p>
        </div>
        <div class="flex items-center gap-1" role="group" aria-label="Time window" data-testid="telemetry-traffic-window">
          {#each TRAFFIC_WINDOWS as minutes (minutes)}
            <button
              type="button"
              class="rounded-md px-3 py-1 text-sm {trafficWindow === minutes ? 'bg-rose-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'}"
              onclick={() => (trafficWindow = minutes)}
              data-testid="telemetry-traffic-window-{minutes}"
              data-state={trafficWindow === minutes ? "selected" : "idle"}
            >
              {minutes} min
            </button>
          {/each}
        </div>
      </div>

      {#if trafficForbidden}
        <p class="p-4 text-sm text-amber-700 dark:text-amber-400" data-testid="telemetry-traffic-forbidden">
          Your user lacks the role <code class="font-mono">CanGetTrafficSources</code>, so the busiest callers cannot be shown here.
        </p>
      {:else if trafficError}
        <p class="p-4 text-sm text-red-700 dark:text-red-400" data-testid="telemetry-traffic-error">{trafficError}</p>
      {:else if traffic === null}
        <p class="p-4 text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      {:else}
        <div class="grid grid-cols-1 gap-px bg-gray-200 dark:bg-gray-700 xl:grid-cols-2">
          <!-- By Consumer -->
          <div class="overflow-x-auto bg-white dark:bg-gray-800">
            <h3 class="px-4 pt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">By Consumer</h3>
            <table class="min-w-full text-sm" data-testid="telemetry-traffic-consumers">
              <thead class="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th class="px-4 py-2">Consumer</th>
                  <th class="px-4 py-2 text-right">Requests</th>
                  <th class="px-4 py-2 text-right">4xx</th>
                  <th class="px-4 py-2 text-right">Refused</th>
                  <th class="px-4 py-2">Last address</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                {#each traffic.consumers as row (row.consumer_id)}
                  <tr data-testid="telemetry-traffic-consumer-row" data-key={row.consumer_id}>
                    <td class="px-4 py-2">
                      <a href="/consumers/{row.consumer_id}" class="font-medium text-blue-700 hover:underline dark:text-blue-400">
                        {row.application_name || row.consumer_id}
                      </a>
                      <div class="font-mono text-xs text-gray-500 dark:text-gray-400">{row.consumer_id}</div>
                    </td>
                    <td class="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatEstimate(row.requests, row.error)}</td>
                    <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatShare(clientErrorShare(row))}</td>
                    <td class="px-4 py-2 text-right {row.refused > 0 ? 'font-semibold text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}">{formatCount(row.refused)}</td>
                    <td class="px-4 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">{row.last_ip_address}</td>
                  </tr>
                {:else}
                  <tr><td colspan="5" class="px-4 py-3 text-gray-600 dark:text-gray-400">No authenticated requests in this window.</td></tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- By address -->
          <div class="overflow-x-auto bg-white dark:bg-gray-800">
            <h3 class="px-4 pt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">By client address</h3>
            <table class="min-w-full text-sm" data-testid="telemetry-traffic-addresses">
              <thead class="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                <tr>
                  <th class="px-4 py-2">Address</th>
                  <th class="px-4 py-2 text-right">Requests</th>
                  <th class="px-4 py-2 text-right">4xx</th>
                  <th class="px-4 py-2 text-right">Unknown paths</th>
                  <th class="px-4 py-2 text-right">Consumers</th>
                  <th class="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                {#each traffic.addresses as row (row.ip_address)}
                  <tr data-testid="telemetry-traffic-address-row" data-key={row.ip_address}>
                    <td class="px-4 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">{row.ip_address}</td>
                    <td class="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatEstimate(row.requests, row.error)}</td>
                    <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatShare(clientErrorShare(row))}</td>
                    <td class="px-4 py-2 text-right {row.unmatched > 0 ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100'}">{formatCount(row.unmatched)}</td>
                    <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100" title={row.consumer_ids.join(", ")}>{row.consumer_ids.length}</td>
                    <td class="px-4 py-2 text-right">
                      <a href={penaliseHref(row.ip_address)} class="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                        data-testid="telemetry-traffic-penalise-{row.ip_address}">Penalise</a>
                    </td>
                  </tr>
                {:else}
                  <tr><td colspan="6" class="px-4 py-3 text-gray-600 dark:text-gray-400">No requests in this window.</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <!-- By caller and endpoint -->
        <div class="overflow-x-auto border-t border-gray-200 dark:border-gray-700">
          <h3 class="px-4 pt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">By caller and endpoint</h3>
          <table class="min-w-full text-sm" data-testid="telemetry-traffic-caller-endpoints">
            <thead class="text-left text-xs uppercase text-gray-500 dark:text-gray-400">
              <tr>
                <th class="px-4 py-2">Caller</th>
                <th class="px-4 py-2">Endpoint</th>
                <th class="px-4 py-2 text-right">Requests</th>
                <th class="px-4 py-2 text-right">4xx</th>
                <th class="px-4 py-2 text-right">5xx</th>
                <th class="px-4 py-2 text-right">Mean</th>
                <th class="px-4 py-2 text-right">Max</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              {#each traffic.callers_and_endpoints as row (`${row.caller_kind}|${row.caller}|${row.endpoint}`)}
                {@const href = metricsSearchHref(row.endpoint, row.api_version ?? null, linkTime)}
                <tr data-testid="telemetry-traffic-caller-endpoint-row" data-key="{row.caller}|{row.endpoint}">
                  <td class="px-4 py-2 font-mono text-xs">
                    <span class="mr-1 rounded bg-gray-100 px-1 text-gray-600 dark:bg-gray-900 dark:text-gray-400">{row.caller_kind}</span>
                    <span class="text-gray-900 dark:text-gray-100">{row.caller}</span>
                  </td>
                  <td class="px-4 py-2 font-mono text-xs">
                    {#if href}
                      <a {href} class="text-blue-700 hover:underline dark:text-blue-400" title="Recent calls in API Metrics">{row.endpoint}</a>
                    {:else}
                      <span class="text-gray-900 dark:text-gray-100">{row.endpoint}</span>
                    {/if}
                  </td>
                  <td class="px-4 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatEstimate(row.requests, row.error)}</td>
                  <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(row.status_4xx)}</td>
                  <td class="px-4 py-2 text-right {row.status_5xx > 0 ? 'font-semibold text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}">{formatCount(row.status_5xx)}</td>
                  <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatMillis(row.mean_duration_ms)}</td>
                  <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatMillis(row.max_duration_ms)}</td>
                </tr>
              {:else}
                <tr><td colspan="7" class="px-4 py-3 text-gray-600 dark:text-gray-400">No requests in this window.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    <!-- Endpoints -->
    <section class="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="telemetry-endpoints">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 p-4 dark:border-gray-700">
        <div class="flex items-center gap-2">
          <Gauge class="h-5 w-5 text-blue-500" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Endpoints ({endpoints.length})</h2>
        </div>
        <input
          type="search"
          name="endpoint-filter"
          placeholder="Filter by operation id"
          aria-label="Filter endpoints by operation id"
          bind:value={endpointFilter}
          class="w-72 rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          data-testid="telemetry-endpoint-filter"
        />
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700" data-testid="telemetry-endpoint-table">
          <thead class="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Operation</th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Calls</th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">4xx</th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">5xx</th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Mean</th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Max</th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Mean items</th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Max items</th>
              <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Mean size</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            {#each filteredEndpoints as row (row.key)}
              {@const shape = responseShapes.get(row.key)}
              {@const href = metricsSearchHref(row.key, row.apiVersion, linkTime)}
              <tr data-testid="telemetry-endpoint-table-row" data-key={row.key}>
                <td class="px-4 py-2 font-mono text-xs">
                  {#if href}
                    <a
                      {href}
                      class="text-blue-700 hover:underline dark:text-blue-400"
                      title="Recent calls in API Metrics"
                      data-testid="telemetry-operation-link"
                    >{row.key}</a>
                  {:else}
                    <span class="text-gray-900 dark:text-gray-100">{row.key}</span>
                  {/if}
                </td>
                <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(row.calls)}</td>
                <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(row.clientErrors)}</td>
                <td class="px-4 py-2 text-right {row.failures > 0 ? 'font-semibold text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}">
                  {formatCount(row.failures)}
                </td>
                <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatMillis(row.meanMillis)}</td>
                <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatMillis(row.maxMillis)}</td>
                <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{shape?.meanItems == null ? "—" : shape.meanItems.toFixed(1)}</td>
                <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(shape?.maxItems ?? null)}</td>
                <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatBytes(shape?.meanBytes ?? null)}</td>
              </tr>
            {:else}
              <tr>
                <td colspan="9" class="px-4 py-4 text-gray-600 dark:text-gray-400">No calls recorded yet.</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <div class="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
      <!-- Connector calls -->
      <section class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="telemetry-connector">
        <div class="flex items-center gap-2 border-b border-gray-200 p-4 dark:border-gray-700">
          <Plug class="h-5 w-5 text-purple-500" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Connector calls ({connectorCalls.length})</h2>
        </div>
        {@render requestTable(connectorCalls, "Connector method", "telemetry-connector-table", false,
          (row) => connectorTracesHref(row.connector, row.connectorMethod, linkTime), "Recent calls in Connector Traces")}
      </section>

      <!-- Redis -->
      <section class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="telemetry-redis">
        <div class="flex items-center gap-2 border-b border-gray-200 p-4 dark:border-gray-700">
          <Database class="h-5 w-5 text-red-500" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Redis commands</h2>
        </div>
        {@render requestTable(redisCommands, "Command", "telemetry-redis-table", false, () => null, "")}
      </section>
    </div>

    <div class="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
      <!-- Caches -->
      <section class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="telemetry-caches">
        <div class="flex items-center gap-2 border-b border-gray-200 p-4 dark:border-gray-700">
          <Layers class="h-5 w-5 text-green-500" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Caches</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700" data-testid="telemetry-cache-table">
            <thead class="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Cache</th>
                <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Hit ratio</th>
                <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Hits</th>
                <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Misses</th>
                <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Entries</th>
                <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Evictions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              {#each caches as cache (cache.cache)}
                <tr data-testid="telemetry-cache-row" data-key={cache.cache}>
                  <td class="px-4 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">{cache.cache}</td>
                  <td class="px-4 py-2 text-right font-semibold text-gray-900 dark:text-gray-100">{formatShare(cache.hitRatio)}</td>
                  <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(cache.hits)}</td>
                  <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(cache.misses)}</td>
                  <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(cache.size)}</td>
                  <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(cache.evictions)}</td>
                </tr>
              {:else}
                <tr><td colspan="6" class="px-4 py-4 text-gray-600 dark:text-gray-400">No caches reported.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Database pool -->
      <section class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="telemetry-pools">
        <div class="flex items-center gap-2 border-b border-gray-200 p-4 dark:border-gray-700">
          <Database class="h-5 w-5 text-blue-500" />
          <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Database connection pool</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700" data-testid="telemetry-pool-table">
            <thead class="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Pool</th>
                <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Active</th>
                <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Idle</th>
                <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Waiting</th>
                <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Max</th>
                <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Timeouts</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              {#each pools as pool (pool.pool)}
                <tr data-testid="telemetry-pool-row" data-key={pool.pool}>
                  <td class="px-4 py-2 font-mono text-xs text-gray-900 dark:text-gray-100">{pool.pool}</td>
                  <td class="px-4 py-2 text-right font-semibold text-gray-900 dark:text-gray-100">{formatCount(pool.active)}</td>
                  <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(pool.idle)}</td>
                  <td class="px-4 py-2 text-right {pool.pending > 0 ? 'font-semibold text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}">{formatCount(pool.pending)}</td>
                  <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(pool.max)}</td>
                  <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(pool.timeouts)}</td>
                </tr>
              {:else}
                <tr><td colspan="6" class="px-4 py-4 text-gray-600 dark:text-gray-400">No connection pool reported.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div class="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
      <!-- Memoised calls -->
      <section class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="telemetry-memoize">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 p-4 dark:border-gray-700">
          <div class="flex items-center gap-2">
            <Layers class="h-5 w-5 text-amber-500" />
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Memoised calls ({memoized.length})</h2>
          </div>
          <input
            type="search"
            name="memoize-filter"
            placeholder="Filter by method"
            aria-label="Filter memoised calls by method"
            bind:value={memoizeFilter}
            class="w-56 rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            data-testid="telemetry-memoize-filter"
          />
        </div>
        <div class="max-h-[420px] overflow-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700" data-testid="telemetry-memoize-table">
            <thead class="sticky top-0 bg-gray-50 dark:bg-gray-900">
              <tr>
                <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Method</th>
                <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Provider</th>
                <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Hit ratio</th>
                <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Hits</th>
                <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Misses</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              {#each filteredMemoized as row (`${row.provider}|${row.cache}`)}
                <tr data-testid="telemetry-memoize-row" data-key="{row.provider}|{row.cache}">
                  <td class="px-4 py-2 font-mono text-xs break-all text-gray-900 dark:text-gray-100">{row.cache}</td>
                  <td class="px-4 py-2 text-xs text-gray-600 dark:text-gray-400">{row.provider}</td>
                  <td class="px-4 py-2 text-right font-semibold text-gray-900 dark:text-gray-100">{formatShare(row.hitRatio)}</td>
                  <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(row.hits)}</td>
                  <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(row.misses)}</td>
                </tr>
              {:else}
                <tr><td colspan="5" class="px-4 py-4 text-gray-600 dark:text-gray-400">No memoised calls recorded yet.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <div class="flex flex-col gap-6">
        <!-- Batch writers -->
        <section class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="telemetry-batch-writers">
          <div class="flex items-center gap-2 border-b border-gray-200 p-4 dark:border-gray-700">
            <Inbox class="h-5 w-5 text-indigo-500" />
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Record writers</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700" data-testid="telemetry-batch-writer-table">
              <thead class="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Records</th>
                  <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Queued</th>
                  <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Written</th>
                  <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Lost</th>
                  <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Waiting</th>
                  <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Failed flushes</th>
                  <th class="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Mean flush</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                {#each batchWriters as writer (writer.writer)}
                  <tr data-testid="telemetry-batch-writer-row" data-key={writer.writer}>
                    <td class="px-4 py-2 text-gray-900 dark:text-gray-100">{batchWriterLabels[writer.writer] ?? writer.writer}</td>
                    <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(writer.queued)}</td>
                    <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(writer.written)}</td>
                    <td class="px-4 py-2 text-right {writer.lost > 0 ? 'font-semibold text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}">{formatCount(writer.lost)}</td>
                    <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatCount(writer.queueDepth)}</td>
                    <td class="px-4 py-2 text-right {writer.failedFlushes > 0 ? 'font-semibold text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}">{formatCount(writer.failedFlushes)}</td>
                    <td class="px-4 py-2 text-right text-gray-900 dark:text-gray-100">{formatMillis(writer.meanFlushMillis)}</td>
                  </tr>
                {:else}
                  <tr><td colspan="7" class="px-4 py-4 text-gray-600 dark:text-gray-400">No records queued on this instance.</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>

        <!-- Other counters -->
        <section class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="telemetry-other-counters">
          <div class="flex items-center gap-2 border-b border-gray-200 p-4 dark:border-gray-700">
            <Hash class="h-5 w-5 text-gray-500" />
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Other counters</h2>
          </div>
          <dl class="grid grid-cols-1 gap-px overflow-hidden rounded-b-lg bg-gray-200 dark:bg-gray-700 sm:grid-cols-2">
            {#each otherCounters as counter (counter.id)}
              <div class="bg-white p-4 dark:bg-gray-800" data-testid="telemetry-other-counter" data-counter={counter.id}>
                <dt class="text-sm text-gray-600 dark:text-gray-400">{counter.label}</dt>
                <dd class="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">{formatCount(counter.value)}</dd>
              </div>
            {/each}
          </dl>
        </section>
      </div>
    </div>

    <!-- Every meter -->
    <section class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="telemetry-meters">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 p-4 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          All meters ({filteredMeters.length} of {meters.length})
        </h2>
        <input
          type="search"
          name="meter-filter"
          placeholder="Name starts with, e.g. jvm.memory"
          aria-label="Filter meters by name prefix"
          bind:value={meterFilter}
          class="w-72 rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          data-testid="telemetry-meter-filter"
        />
      </div>
      <div class="max-h-[600px] overflow-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700" data-testid="telemetry-meter-table">
          <thead class="sticky top-0 bg-gray-50 dark:bg-gray-900">
            <tr>
              <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
              <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Values</th>
              <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Tags</th>
              <th class="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Type</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            {#each filteredMeters as meter, index (`${meter.name}|${formatTags(meter.tags)}|${index}`)}
              <tr data-testid="telemetry-meter-row" data-name={meter.name}>
                <td class="px-4 py-2 align-top font-mono text-xs whitespace-nowrap text-gray-900 dark:text-gray-100">{meter.name}</td>
                <td class="px-4 py-2 align-top" data-testid="telemetry-meter-values">
                  <div class="flex flex-wrap gap-1.5">
                    {#each Object.entries(meter.measurements) as [statistic, value] (statistic)}
                      <span
                        class="inline-flex items-baseline gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs whitespace-nowrap dark:bg-gray-900"
                        data-testid="telemetry-meter-value"
                        data-statistic={statistic}
                      >
                        <span class="text-gray-500 dark:text-gray-400">{statistic}</span>
                        <span class="font-mono font-semibold text-gray-900 dark:text-gray-100">{formatMeasurement(value)}</span>
                        <span class="text-gray-500 dark:text-gray-400">{measurementUnit(statistic, meter.base_unit)}</span>
                      </span>
                    {:else}
                      <span class="text-xs text-gray-500 dark:text-gray-400">no value</span>
                    {/each}
                  </div>
                </td>
                <td class="px-4 py-2 align-top font-mono text-xs break-all text-gray-600 dark:text-gray-400">{formatTags(meter.tags)}</td>
                <td class="px-4 py-2 align-top text-xs whitespace-nowrap text-gray-600 dark:text-gray-400">{meter.type}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}
</div>
