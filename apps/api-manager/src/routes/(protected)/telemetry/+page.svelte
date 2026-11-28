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
    <table class="min-w-full divide-y text-sm ui-border" data-testid={testId}>
      <thead class="ui-card">
        <tr>
          <th class="px-4 py-2 text-left font-medium ui-muted">{keyLabel}</th>
          <th class="px-4 py-2 text-right font-medium ui-muted">Calls</th>
          {#if showClientErrors}
            <th class="px-4 py-2 text-right font-medium ui-muted">4xx</th>
            <th class="px-4 py-2 text-right font-medium ui-muted">5xx</th>
          {:else}
            <th class="px-4 py-2 text-right font-medium ui-muted">Failed</th>
          {/if}
          <th class="px-4 py-2 text-right font-medium ui-muted">Mean</th>
          <th class="px-4 py-2 text-right font-medium ui-muted">Max</th>
        </tr>
      </thead>
      <tbody class="divide-y ui-border">
        {#each rows as row (row.key)}
          {@const href = hrefOf(row)}
          <tr data-testid="{testId}-row" data-key={row.key}>
            <td class="px-4 py-2 font-mono text-xs">
              {#if href}
                <a {href} class="hover:underline ui-link" title={linkTitle} data-testid="{testId}-link">{row.key}</a>
              {:else}
                <span class="ui-text">{row.key}</span>
              {/if}
            </td>
            <td class="px-4 py-2 text-right ui-text">{formatCount(row.calls)}</td>
            {#if showClientErrors}
              <td class="px-4 py-2 text-right ui-text">{formatCount(row.clientErrors)}</td>
            {/if}
            <td class="px-4 py-2 text-right {row.failures > 0 ? 'font-semibold ui-text-error' : 'ui-text'}">
              {formatCount(row.failures)}
            </td>
            <td class="px-4 py-2 text-right ui-text">{formatMillis(row.meanMillis)}</td>
            <td class="px-4 py-2 text-right ui-text">{formatMillis(row.maxMillis)}</td>
          </tr>
        {:else}
          <tr>
            <td colspan={showClientErrors ? 6 : 5} class="px-4 py-4 ui-muted">No calls recorded yet.</td>
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
      <h1 class="text-3xl font-bold ui-text">Telemetry</h1>
      <p class="mt-1 ui-muted">
        How the OBP-API instance that answered is running: requests, Connector calls, caches, the
        database pool, memory and threads. Figures are since that instance started. Unlike API
        Metrics, Telemetry never records who made a call.
      </p>
    </div>
    {#if data.hasRole}
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50 ui-card ui-hover ui-muted ui-border"
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
      class="mb-6 grid grid-cols-1 gap-px overflow-hidden rounded-lg border shadow-sm sm:grid-cols-3 ui-panel ui-border"
      data-testid="telemetry-instance"
    >
      <div class="p-4 ui-card">
        <p class="text-sm font-medium ui-muted">Instance</p>
        <code class="mt-1 block break-all text-sm ui-text" data-testid="telemetry-instance-id">
          {telemetry.api_instance_id}
        </code>
        <p class="mt-1 text-xs ui-muted"><code>api_instance_id</code></p>
      </div>
      <div class="p-4 ui-card">
        <p class="text-sm font-medium ui-muted">Build</p>
        <code class="mt-1 block break-all text-sm ui-text">{telemetry.git_commit}</code>
        <p class="mt-1 text-xs ui-muted">git commit</p>
      </div>
      <div class="p-4 ui-card" data-testid="telemetry-port" data-state={telemetry.port.enabled ? "open" : "closed"}>
        <p class="text-sm font-medium ui-muted">Prometheus port</p>
        <p class="mt-1 text-sm ui-text">
          {#if telemetry.port.enabled}
            Open on port {telemetry.port.port}, path <code>{telemetry.port.path}</code>
          {:else}
            Not open
          {/if}
        </p>
        <p class="mt-1 text-xs ui-muted" data-testid="telemetry-port-props">
          Set in Props: <code>telemetry.port.enabled</code>, <code>telemetry.port</code>, <code>telemetry.host</code>
        </p>
      </div>
    </div>

    <!-- Tiles -->
    <div class="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {#each tiles as tile (tile.id)}
        <div
          class="rounded-lg border p-4 shadow-sm ui-card ui-border"
          data-testid="telemetry-tile"
          data-tile={tile.id}
        >
          <div class="flex items-center gap-2 text-sm font-medium ui-muted">
            <tile.icon class="h-4 w-4" />
            {tile.label}
          </div>
          <p class="mt-2 text-2xl font-bold ui-text">{tile.value}</p>
          <p class="text-xs ui-muted">{tile.detail}</p>
        </div>
      {/each}
    </div>

    <!-- Where traffic is coming from -->
    <section class="mb-6 rounded-lg border shadow-sm ui-card ui-border" data-testid="telemetry-traffic">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b p-4 ui-border">
        <div>
          <div class="flex items-center gap-2">
            <Users class="h-5 w-5 ui-text-error" />
            <h2 class="text-lg font-semibold ui-text">Where traffic is coming from</h2>
          </div>
          <p class="mt-1 text-xs ui-muted">
            The busiest Consumers, client addresses, and callers and endpoints on this instance. Counts are estimates
            (Space-Saving, Metwally, Agrawal and El Abbadi, 2005): ± is the most they can be out.
          </p>
        </div>
        <div class="flex items-center gap-1" role="group" aria-label="Time window" data-testid="telemetry-traffic-window">
          {#each TRAFFIC_WINDOWS as minutes (minutes)}
            <button
              type="button"
              class="rounded-md px-3 py-1 text-sm {trafficWindow === minutes ? 'preset-filled-error-500' : 'border ui-hover ui-muted ui-border'}"
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
        <p class="p-4 text-sm ui-text-warning" data-testid="telemetry-traffic-forbidden">
          Your user lacks the role <code class="font-mono">CanGetTrafficSources</code>, so the busiest callers cannot be shown here.
        </p>
      {:else if trafficError}
        <p class="p-4 text-sm ui-text-error" data-testid="telemetry-traffic-error">{trafficError}</p>
      {:else if traffic === null}
        <p class="p-4 text-sm ui-muted">Loading...</p>
      {:else}
        <div class="grid grid-cols-1 gap-px xl:grid-cols-2 ui-panel">
          <!-- By Consumer -->
          <div class="overflow-x-auto ui-card">
            <h3 class="px-4 pt-3 text-sm font-semibold ui-text">By Consumer</h3>
            <table class="min-w-full text-sm" data-testid="telemetry-traffic-consumers">
              <thead class="text-left text-xs uppercase ui-muted">
                <tr>
                  <th class="px-4 py-2">Consumer</th>
                  <th class="px-4 py-2 text-right">Requests</th>
                  <th class="px-4 py-2 text-right">4xx</th>
                  <th class="px-4 py-2 text-right">Refused</th>
                  <th class="px-4 py-2">Last address</th>
                </tr>
              </thead>
              <tbody class="divide-y ui-border">
                {#each traffic.consumers as row (row.consumer_id)}
                  <tr data-testid="telemetry-traffic-consumer-row" data-key={row.consumer_id}>
                    <td class="px-4 py-2">
                      <a href="/consumers/{row.consumer_id}" class="font-medium hover:underline ui-link">
                        {row.application_name || row.consumer_id}
                      </a>
                      <div class="font-mono text-xs ui-muted">{row.consumer_id}</div>
                    </td>
                    <td class="px-4 py-2 text-right tabular-nums ui-text">{formatEstimate(row.requests, row.error)}</td>
                    <td class="px-4 py-2 text-right ui-text">{formatShare(clientErrorShare(row))}</td>
                    <td class="px-4 py-2 text-right {row.refused > 0 ? 'font-semibold ui-text-error' : 'ui-text'}">{formatCount(row.refused)}</td>
                    <td class="px-4 py-2 font-mono text-xs ui-muted">{row.last_ip_address}</td>
                  </tr>
                {:else}
                  <tr><td colspan="5" class="px-4 py-3 ui-muted">No authenticated requests in this window.</td></tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- By address -->
          <div class="overflow-x-auto ui-card">
            <h3 class="px-4 pt-3 text-sm font-semibold ui-text">By client address</h3>
            <table class="min-w-full text-sm" data-testid="telemetry-traffic-addresses">
              <thead class="text-left text-xs uppercase ui-muted">
                <tr>
                  <th class="px-4 py-2">Address</th>
                  <th class="px-4 py-2 text-right">Requests</th>
                  <th class="px-4 py-2 text-right">4xx</th>
                  <th class="px-4 py-2 text-right">Unknown paths</th>
                  <th class="px-4 py-2 text-right">Consumers</th>
                  <th class="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody class="divide-y ui-border">
                {#each traffic.addresses as row (row.ip_address)}
                  <tr data-testid="telemetry-traffic-address-row" data-key={row.ip_address}>
                    <td class="px-4 py-2 font-mono text-xs ui-text">{row.ip_address}</td>
                    <td class="px-4 py-2 text-right tabular-nums ui-text">{formatEstimate(row.requests, row.error)}</td>
                    <td class="px-4 py-2 text-right ui-text">{formatShare(clientErrorShare(row))}</td>
                    <td class="px-4 py-2 text-right {row.unmatched > 0 ? 'font-semibold ui-text-warning' : 'ui-text'}">{formatCount(row.unmatched)}</td>
                    <td class="px-4 py-2 text-right ui-text" title={row.consumer_ids.join(", ")}>{row.consumer_ids.length}</td>
                    <td class="px-4 py-2 text-right">
                      <a href={penaliseHref(row.ip_address)} class="rounded-md border px-2 py-1 text-xs ui-tone-error"
                        data-testid="telemetry-traffic-penalise-{row.ip_address}">Penalise</a>
                    </td>
                  </tr>
                {:else}
                  <tr><td colspan="6" class="px-4 py-3 ui-muted">No requests in this window.</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <!-- By caller and endpoint -->
        <div class="overflow-x-auto border-t ui-border">
          <h3 class="px-4 pt-3 text-sm font-semibold ui-text">By caller and endpoint</h3>
          <table class="min-w-full text-sm" data-testid="telemetry-traffic-caller-endpoints">
            <thead class="text-left text-xs uppercase ui-muted">
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
            <tbody class="divide-y ui-border">
              {#each traffic.callers_and_endpoints as row (`${row.caller_kind}|${row.caller}|${row.endpoint}`)}
                {@const href = metricsSearchHref(row.endpoint, row.api_version ?? null, linkTime)}
                <tr data-testid="telemetry-traffic-caller-endpoint-row" data-key="{row.caller}|{row.endpoint}">
                  <td class="px-4 py-2 font-mono text-xs">
                    <span class="mr-1 rounded px-1 ui-panel ui-muted">{row.caller_kind}</span>
                    <span class="ui-text">{row.caller}</span>
                  </td>
                  <td class="px-4 py-2 font-mono text-xs">
                    {#if href}
                      <a {href} class="hover:underline ui-link" title="Recent calls in API Metrics">{row.endpoint}</a>
                    {:else}
                      <span class="ui-text">{row.endpoint}</span>
                    {/if}
                  </td>
                  <td class="px-4 py-2 text-right tabular-nums ui-text">{formatEstimate(row.requests, row.error)}</td>
                  <td class="px-4 py-2 text-right ui-text">{formatCount(row.status_4xx)}</td>
                  <td class="px-4 py-2 text-right {row.status_5xx > 0 ? 'font-semibold ui-text-error' : 'ui-text'}">{formatCount(row.status_5xx)}</td>
                  <td class="px-4 py-2 text-right ui-text">{formatMillis(row.mean_duration_ms)}</td>
                  <td class="px-4 py-2 text-right ui-text">{formatMillis(row.max_duration_ms)}</td>
                </tr>
              {:else}
                <tr><td colspan="7" class="px-4 py-3 ui-muted">No requests in this window.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>

    <!-- Endpoints -->
    <section class="mb-6 rounded-lg border shadow-sm ui-card ui-border" data-testid="telemetry-endpoints">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b p-4 ui-border">
        <div class="flex items-center gap-2">
          <Gauge class="h-5 w-5 ui-link" />
          <h2 class="text-lg font-semibold ui-text">Endpoints ({endpoints.length})</h2>
        </div>
        <input
          type="search"
          name="endpoint-filter"
          placeholder="Filter by operation id"
          aria-label="Filter endpoints by operation id"
          bind:value={endpointFilter}
          class="w-72 rounded-md border px-3 py-1.5 text-sm ui-card ui-text ui-border"
          data-testid="telemetry-endpoint-filter"
        />
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y text-sm ui-border" data-testid="telemetry-endpoint-table">
          <thead class="ui-card">
            <tr>
              <th class="px-4 py-2 text-left font-medium ui-muted">Operation</th>
              <th class="px-4 py-2 text-right font-medium ui-muted">Calls</th>
              <th class="px-4 py-2 text-right font-medium ui-muted">4xx</th>
              <th class="px-4 py-2 text-right font-medium ui-muted">5xx</th>
              <th class="px-4 py-2 text-right font-medium ui-muted">Mean</th>
              <th class="px-4 py-2 text-right font-medium ui-muted">Max</th>
              <th class="px-4 py-2 text-right font-medium ui-muted">Mean items</th>
              <th class="px-4 py-2 text-right font-medium ui-muted">Max items</th>
              <th class="px-4 py-2 text-right font-medium ui-muted">Mean size</th>
            </tr>
          </thead>
          <tbody class="divide-y ui-border">
            {#each filteredEndpoints as row (row.key)}
              {@const shape = responseShapes.get(row.key)}
              {@const href = metricsSearchHref(row.key, row.apiVersion, linkTime)}
              <tr data-testid="telemetry-endpoint-table-row" data-key={row.key}>
                <td class="px-4 py-2 font-mono text-xs">
                  {#if href}
                    <a
                      {href}
                      class="hover:underline ui-link"
                      title="Recent calls in API Metrics"
                      data-testid="telemetry-operation-link"
                    >{row.key}</a>
                  {:else}
                    <span class="ui-text">{row.key}</span>
                  {/if}
                </td>
                <td class="px-4 py-2 text-right ui-text">{formatCount(row.calls)}</td>
                <td class="px-4 py-2 text-right ui-text">{formatCount(row.clientErrors)}</td>
                <td class="px-4 py-2 text-right {row.failures > 0 ? 'font-semibold ui-text-error' : 'ui-text'}">
                  {formatCount(row.failures)}
                </td>
                <td class="px-4 py-2 text-right ui-text">{formatMillis(row.meanMillis)}</td>
                <td class="px-4 py-2 text-right ui-text">{formatMillis(row.maxMillis)}</td>
                <td class="px-4 py-2 text-right ui-text">{shape?.meanItems == null ? "—" : shape.meanItems.toFixed(1)}</td>
                <td class="px-4 py-2 text-right ui-text">{formatCount(shape?.maxItems ?? null)}</td>
                <td class="px-4 py-2 text-right ui-text">{formatBytes(shape?.meanBytes ?? null)}</td>
              </tr>
            {:else}
              <tr>
                <td colspan="9" class="px-4 py-4 ui-muted">No calls recorded yet.</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <div class="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
      <!-- Connector calls -->
      <section class="rounded-lg border shadow-sm ui-card ui-border" data-testid="telemetry-connector">
        <div class="flex items-center gap-2 border-b p-4 ui-border">
          <Plug class="h-5 w-5 ui-text-brand" />
          <h2 class="text-lg font-semibold ui-text">Connector calls ({connectorCalls.length})</h2>
        </div>
        {@render requestTable(connectorCalls, "Connector method", "telemetry-connector-table", false,
          (row) => connectorTracesHref(row.connector, row.connectorMethod, linkTime), "Recent calls in Connector Traces")}
      </section>

      <!-- Redis -->
      <section class="rounded-lg border shadow-sm ui-card ui-border" data-testid="telemetry-redis">
        <div class="flex items-center gap-2 border-b p-4 ui-border">
          <Database class="h-5 w-5 ui-text-error" />
          <h2 class="text-lg font-semibold ui-text">Redis commands</h2>
        </div>
        {@render requestTable(redisCommands, "Command", "telemetry-redis-table", false, () => null, "")}
      </section>
    </div>

    <div class="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
      <!-- Caches -->
      <section class="rounded-lg border shadow-sm ui-card ui-border" data-testid="telemetry-caches">
        <div class="flex items-center gap-2 border-b p-4 ui-border">
          <Layers class="h-5 w-5 ui-text-success" />
          <h2 class="text-lg font-semibold ui-text">Caches</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y text-sm ui-border" data-testid="telemetry-cache-table">
            <thead class="ui-card">
              <tr>
                <th class="px-4 py-2 text-left font-medium ui-muted">Cache</th>
                <th class="px-4 py-2 text-right font-medium ui-muted">Hit ratio</th>
                <th class="px-4 py-2 text-right font-medium ui-muted">Hits</th>
                <th class="px-4 py-2 text-right font-medium ui-muted">Misses</th>
                <th class="px-4 py-2 text-right font-medium ui-muted">Entries</th>
                <th class="px-4 py-2 text-right font-medium ui-muted">Evictions</th>
              </tr>
            </thead>
            <tbody class="divide-y ui-border">
              {#each caches as cache (cache.cache)}
                <tr data-testid="telemetry-cache-row" data-key={cache.cache}>
                  <td class="px-4 py-2 font-mono text-xs ui-text">{cache.cache}</td>
                  <td class="px-4 py-2 text-right font-semibold ui-text">{formatShare(cache.hitRatio)}</td>
                  <td class="px-4 py-2 text-right ui-text">{formatCount(cache.hits)}</td>
                  <td class="px-4 py-2 text-right ui-text">{formatCount(cache.misses)}</td>
                  <td class="px-4 py-2 text-right ui-text">{formatCount(cache.size)}</td>
                  <td class="px-4 py-2 text-right ui-text">{formatCount(cache.evictions)}</td>
                </tr>
              {:else}
                <tr><td colspan="6" class="px-4 py-4 ui-muted">No caches reported.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <!-- Database pool -->
      <section class="rounded-lg border shadow-sm ui-card ui-border" data-testid="telemetry-pools">
        <div class="flex items-center gap-2 border-b p-4 ui-border">
          <Database class="h-5 w-5 ui-link" />
          <h2 class="text-lg font-semibold ui-text">Database connection pool</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y text-sm ui-border" data-testid="telemetry-pool-table">
            <thead class="ui-card">
              <tr>
                <th class="px-4 py-2 text-left font-medium ui-muted">Pool</th>
                <th class="px-4 py-2 text-right font-medium ui-muted">Active</th>
                <th class="px-4 py-2 text-right font-medium ui-muted">Idle</th>
                <th class="px-4 py-2 text-right font-medium ui-muted">Waiting</th>
                <th class="px-4 py-2 text-right font-medium ui-muted">Max</th>
                <th class="px-4 py-2 text-right font-medium ui-muted">Timeouts</th>
              </tr>
            </thead>
            <tbody class="divide-y ui-border">
              {#each pools as pool (pool.pool)}
                <tr data-testid="telemetry-pool-row" data-key={pool.pool}>
                  <td class="px-4 py-2 font-mono text-xs ui-text">{pool.pool}</td>
                  <td class="px-4 py-2 text-right font-semibold ui-text">{formatCount(pool.active)}</td>
                  <td class="px-4 py-2 text-right ui-text">{formatCount(pool.idle)}</td>
                  <td class="px-4 py-2 text-right {pool.pending > 0 ? 'font-semibold ui-text-error' : 'ui-text'}">{formatCount(pool.pending)}</td>
                  <td class="px-4 py-2 text-right ui-text">{formatCount(pool.max)}</td>
                  <td class="px-4 py-2 text-right ui-text">{formatCount(pool.timeouts)}</td>
                </tr>
              {:else}
                <tr><td colspan="6" class="px-4 py-4 ui-muted">No connection pool reported.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div class="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
      <!-- Memoised calls -->
      <section class="rounded-lg border shadow-sm ui-card ui-border" data-testid="telemetry-memoize">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b p-4 ui-border">
          <div class="flex items-center gap-2">
            <Layers class="h-5 w-5 ui-text-warning" />
            <h2 class="text-lg font-semibold ui-text">Memoised calls ({memoized.length})</h2>
          </div>
          <input
            type="search"
            name="memoize-filter"
            placeholder="Filter by method"
            aria-label="Filter memoised calls by method"
            bind:value={memoizeFilter}
            class="w-56 rounded-md border px-3 py-1.5 text-sm ui-card ui-text ui-border"
            data-testid="telemetry-memoize-filter"
          />
        </div>
        <div class="max-h-[420px] overflow-auto">
          <table class="min-w-full divide-y text-sm ui-border" data-testid="telemetry-memoize-table">
            <thead class="sticky top-0 ui-card">
              <tr>
                <th class="px-4 py-2 text-left font-medium ui-muted">Method</th>
                <th class="px-4 py-2 text-left font-medium ui-muted">Provider</th>
                <th class="px-4 py-2 text-right font-medium ui-muted">Hit ratio</th>
                <th class="px-4 py-2 text-right font-medium ui-muted">Hits</th>
                <th class="px-4 py-2 text-right font-medium ui-muted">Misses</th>
              </tr>
            </thead>
            <tbody class="divide-y ui-border">
              {#each filteredMemoized as row (`${row.provider}|${row.cache}`)}
                <tr data-testid="telemetry-memoize-row" data-key="{row.provider}|{row.cache}">
                  <td class="px-4 py-2 font-mono text-xs break-all ui-text">{row.cache}</td>
                  <td class="px-4 py-2 text-xs ui-muted">{row.provider}</td>
                  <td class="px-4 py-2 text-right font-semibold ui-text">{formatShare(row.hitRatio)}</td>
                  <td class="px-4 py-2 text-right ui-text">{formatCount(row.hits)}</td>
                  <td class="px-4 py-2 text-right ui-text">{formatCount(row.misses)}</td>
                </tr>
              {:else}
                <tr><td colspan="5" class="px-4 py-4 ui-muted">No memoised calls recorded yet.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>

      <div class="flex flex-col gap-6">
        <!-- Batch writers -->
        <section class="rounded-lg border shadow-sm ui-card ui-border" data-testid="telemetry-batch-writers">
          <div class="flex items-center gap-2 border-b p-4 ui-border">
            <Inbox class="h-5 w-5 ui-link" />
            <h2 class="text-lg font-semibold ui-text">Record writers</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y text-sm ui-border" data-testid="telemetry-batch-writer-table">
              <thead class="ui-card">
                <tr>
                  <th class="px-4 py-2 text-left font-medium ui-muted">Records</th>
                  <th class="px-4 py-2 text-right font-medium ui-muted">Queued</th>
                  <th class="px-4 py-2 text-right font-medium ui-muted">Written</th>
                  <th class="px-4 py-2 text-right font-medium ui-muted">Lost</th>
                  <th class="px-4 py-2 text-right font-medium ui-muted">Waiting</th>
                  <th class="px-4 py-2 text-right font-medium ui-muted">Failed flushes</th>
                  <th class="px-4 py-2 text-right font-medium ui-muted">Mean flush</th>
                </tr>
              </thead>
              <tbody class="divide-y ui-border">
                {#each batchWriters as writer (writer.writer)}
                  <tr data-testid="telemetry-batch-writer-row" data-key={writer.writer}>
                    <td class="px-4 py-2 ui-text">{batchWriterLabels[writer.writer] ?? writer.writer}</td>
                    <td class="px-4 py-2 text-right ui-text">{formatCount(writer.queued)}</td>
                    <td class="px-4 py-2 text-right ui-text">{formatCount(writer.written)}</td>
                    <td class="px-4 py-2 text-right {writer.lost > 0 ? 'font-semibold ui-text-error' : 'ui-text'}">{formatCount(writer.lost)}</td>
                    <td class="px-4 py-2 text-right ui-text">{formatCount(writer.queueDepth)}</td>
                    <td class="px-4 py-2 text-right {writer.failedFlushes > 0 ? 'font-semibold ui-text-error' : 'ui-text'}">{formatCount(writer.failedFlushes)}</td>
                    <td class="px-4 py-2 text-right ui-text">{formatMillis(writer.meanFlushMillis)}</td>
                  </tr>
                {:else}
                  <tr><td colspan="7" class="px-4 py-4 ui-muted">No records queued on this instance.</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
        </section>

        <!-- Other counters -->
        <section class="rounded-lg border shadow-sm ui-card ui-border" data-testid="telemetry-other-counters">
          <div class="flex items-center gap-2 border-b p-4 ui-border">
            <Hash class="h-5 w-5 ui-muted" />
            <h2 class="text-lg font-semibold ui-text">Other counters</h2>
          </div>
          <dl class="grid grid-cols-1 gap-px overflow-hidden rounded-b-lg sm:grid-cols-2 ui-panel">
            {#each otherCounters as counter (counter.id)}
              <div class="p-4 ui-card" data-testid="telemetry-other-counter" data-counter={counter.id}>
                <dt class="text-sm ui-muted">{counter.label}</dt>
                <dd class="mt-1 text-lg font-semibold ui-text">{formatCount(counter.value)}</dd>
              </div>
            {/each}
          </dl>
        </section>
      </div>
    </div>

    <!-- Every meter -->
    <section class="rounded-lg border shadow-sm ui-card ui-border" data-testid="telemetry-meters">
      <div class="flex flex-wrap items-center justify-between gap-4 border-b p-4 ui-border">
        <h2 class="text-lg font-semibold ui-text">
          All meters ({filteredMeters.length} of {meters.length})
        </h2>
        <input
          type="search"
          name="meter-filter"
          placeholder="Name starts with, e.g. jvm.memory"
          aria-label="Filter meters by name prefix"
          bind:value={meterFilter}
          class="w-72 rounded-md border px-3 py-1.5 text-sm ui-card ui-text ui-border"
          data-testid="telemetry-meter-filter"
        />
      </div>
      <div class="max-h-[600px] overflow-auto">
        <table class="min-w-full divide-y text-sm ui-border" data-testid="telemetry-meter-table">
          <thead class="sticky top-0 ui-card">
            <tr>
              <th class="px-4 py-2 text-left font-medium ui-muted">Name</th>
              <th class="px-4 py-2 text-left font-medium ui-muted">Values</th>
              <th class="px-4 py-2 text-left font-medium ui-muted">Tags</th>
              <th class="px-4 py-2 text-left font-medium ui-muted">Type</th>
            </tr>
          </thead>
          <tbody class="divide-y ui-border">
            {#each filteredMeters as meter, index (`${meter.name}|${formatTags(meter.tags)}|${index}`)}
              <tr data-testid="telemetry-meter-row" data-name={meter.name}>
                <td class="px-4 py-2 align-top font-mono text-xs whitespace-nowrap ui-text">{meter.name}</td>
                <td class="px-4 py-2 align-top" data-testid="telemetry-meter-values">
                  <div class="flex flex-wrap gap-1.5">
                    {#each Object.entries(meter.measurements) as [statistic, value] (statistic)}
                      <span
                        class="inline-flex items-baseline gap-1 rounded px-1.5 py-0.5 text-xs whitespace-nowrap ui-panel"
                        data-testid="telemetry-meter-value"
                        data-statistic={statistic}
                      >
                        <span class="ui-muted">{statistic}</span>
                        <span class="font-mono font-semibold ui-text">{formatMeasurement(value)}</span>
                        <span class="ui-muted">{measurementUnit(statistic, meter.base_unit)}</span>
                      </span>
                    {:else}
                      <span class="text-xs ui-muted">no value</span>
                    {/each}
                  </div>
                </td>
                <td class="px-4 py-2 align-top font-mono text-xs break-all ui-muted">{formatTags(meter.tags)}</td>
                <td class="px-4 py-2 align-top text-xs whitespace-nowrap ui-muted">{meter.type}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}
</div>
