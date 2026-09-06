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
  import { invalidate } from "$app/navigation";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import ErrorMessage from "$lib/components/ErrorMessage.svelte";
  import { pageHeading } from "$lib/stores/pageHeading.svelte";
  import { pageDataSummary } from "$lib/stores/pageDataSummary.svelte";
  import { ACTIVITY_WINDOWS, windowFor, formatObpDate } from "@obp/shared/obp";
  import type { ActivityDelta, ActivityWindowRow } from "@obp/shared/obp";
  import type { ConsentTile, ConsentTrafficRow, DashboardTile } from "./+page.server";

  let { data } = $props();

  let refreshing = $state(false);
  async function refresh() {
    refreshing = true;
    try {
      await invalidate("app:system-activity-dashboard");
    } finally {
      refreshing = false;
    }
  }

  function formatCount(value: number): string {
    return value.toLocaleString("en-US");
  }

  function formatDeltaPct(delta: ActivityDelta): string {
    if (delta.pct === null) {
      // Rising from a zero reference: there is no meaningful percentage.
      return delta.direction === "up" ? "new" : "0%";
    }
    const magnitude = Math.abs(delta.pct);
    const rounded = magnitude >= 10 ? Math.round(magnitude).toString() : magnitude.toFixed(1);
    const sign = delta.pct > 0 ? "+" : delta.pct < 0 ? "−" : "";
    return `${sign}${rounded}%`;
  }

  function deltaSymbol(delta: ActivityDelta): string {
    return delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "—";
  }

  function deltaClass(delta: ActivityDelta): string {
    if (delta.direction === "up") return "text-green-700 dark:text-green-400";
    if (delta.direction === "down") return "text-red-700 dark:text-red-400";
    return "text-gray-600 dark:text-gray-400";
  }

  const asOfLabel = $derived(
    new Date(data.asOf).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }) + " UTC",
  );

  // Drill-down links carry the EXACT snapped window the tile was computed from, so the
  // target page provably shows the same query the number came from.
  function windowQuery(key: string): string {
    const def = ACTIVITY_WINDOWS.find((d) => d.key === key);
    if (!def) return "";
    const w = windowFor(new Date(data.asOf), def.ms);
    return `from_date=${encodeURIComponent(formatObpDate(w.from))}&to_date=${encodeURIComponent(formatObpDate(w.to))}`;
  }

  function okRow(tile: DashboardTile | ConsentTile, key: string): ActivityWindowRow | null {
    if (tile.status !== "ok") return null;
    return tile.rows.find((row: ActivityWindowRow) => row.key === key) ?? null;
  }

  const summaryText = $derived.by(() => {
    const parts: string[] = [];
    const calls = okRow(data.tiles.apiCalls, "24h");
    if (calls) parts.push(`${formatCount(calls.value)} API calls in last 24h`);
    const users = okRow(data.tiles.activeUsers, "24h");
    if (users) parts.push(`${formatCount(users.value)} active users`);
    const newUsers = okRow(data.tiles.newUsers, "7d");
    if (newUsers) parts.push(`${formatCount(newUsers.value)} new users in 7d`);
    const newConsumers = okRow(data.tiles.newConsumers, "7d");
    if (newConsumers) parts.push(`${formatCount(newConsumers.value)} new consumers in 7d`);
    return parts.join(", ");
  });

  $effect(() => {
    pageHeading.set("Activity Summary Dashboard");
    pageDataSummary.set(summaryText);
    return () => {
      pageHeading.clear();
      pageDataSummary.clear();
    };
  });

  function tileState(tile: DashboardTile | ConsentTile): string {
    return tile.status;
  }
</script>

{#snippet deltaChip(row: ActivityWindowRow, testId: string)}
  {#if row.delta}
    <span class={deltaClass(row.delta)} data-testid={testId}>
      {deltaSymbol(row.delta)} {formatDeltaPct(row.delta)}
    </span>
    <span class="text-gray-600 dark:text-gray-400">
      {row.compareLabel}{#if row.reference !== null} ({formatCount(row.reference)}){/if}
    </span>
  {:else}
    <span class="text-gray-600 dark:text-gray-400" data-testid={testId}>no comparison data</span>
  {/if}
{/snippet}

{#snippet tileProblem(tile: DashboardTile | ConsentTile)}
  {#if tile.status === "error"}
    {#if tile.httpStatus === 403}
      <MissingRoleAlert roles={[tile.role]} message={tile.message} />
    {:else}
      <ErrorMessage message={tile.message} />
    {/if}
  {:else if tile.status === "unavailable"}
    <p class="text-sm text-gray-600 dark:text-gray-400">{tile.message}</p>
  {/if}
{/snippet}

{#snippet statCard(title: string, testId: string, href: string, hrefLabel: string, tile: DashboardTile, note: string | null, hrefForRow: ((key: string) => string) | null)}
  <div
    class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
    data-testid={testId}
    data-state={tileState(tile)}
  >
    <div class="mb-1 flex items-baseline justify-between gap-2">
      <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <a href={href} class="text-xs text-blue-600 hover:underline dark:text-blue-400">{hrefLabel}</a>
    </div>
    {#if note}
      <p class="mb-2 text-xs text-gray-600 dark:text-gray-400">{note}</p>
    {/if}
    {#if tile.status === "ok"}
      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        {#each tile.rows as row (row.key)}
          <div class="flex items-baseline gap-3 py-2" data-testid="{testId}-{row.key}">
            <div class="w-24 shrink-0 text-xs">
              {#if hrefForRow}
                <a
                  href={hrefForRow(row.key)}
                  class="text-blue-600 hover:underline dark:text-blue-400"
                  data-testid="{testId}-{row.key}-link">{row.label}</a
                >
              {:else}
                <span class="text-gray-600 dark:text-gray-400">{row.label}</span>
              {/if}
            </div>
            <div class="text-xl font-semibold" data-testid="{testId}-{row.key}-value">
              {formatCount(row.value)}{#if tile.truncated}+{/if}
            </div>
            <div class="min-w-0 text-right text-xs" style="margin-left:auto">
              {@render deltaChip(row, `${testId}-${row.key}-delta`)}
            </div>
          </div>
        {/each}
      </div>
      {#if tile.truncated}
        <p class="mt-2 text-xs text-gray-600 dark:text-gray-400">
          Paging stopped at the safety cap, so these counts are lower bounds.
        </p>
      {/if}
    {:else}
      {@render tileProblem(tile)}
    {/if}
  </div>
{/snippet}

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Activity Summary Dashboard</h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400" data-testid="dashboard-as-of">
        As of {asOfLabel} — figures lag 10 minutes so cached snapshots stay exact.
        Hour and day windows compare to the same window last week; longer windows to the previous period.
      </p>
    </div>
    <button
      type="button"
      onclick={refresh}
      disabled={refreshing}
      data-testid="dashboard-refresh"
      class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
    >
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  </div>

  <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    {@render statCard("API calls", "dashboard-api-calls", "/aggregate-metrics-trends", "Trends", data.tiles.apiCalls, null, (key) => `/metrics?${windowQuery(key)}`)}
    {@render statCard(
      "Active users",
      "dashboard-active-users",
      "/metrics",
      "API Metrics",
      data.tiles.activeUsers,
      "Distinct humans. Calls made via consents (e.g. by agents) count for the granting user.",
      (key) => `/system-activity-dashboard/active-users?${windowQuery(key)}`,
    )}
    {@render statCard("Active consumers", "dashboard-active-consumers", "/consumers", "Consumers", data.tiles.activeConsumers, null, (key) => `/system-activity-dashboard/active-consumers?${windowQuery(key)}`)}

    <div
      class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      data-testid="dashboard-consent-traffic"
      data-state={tileState(data.tiles.consentTraffic)}
    >
      <div class="mb-1 flex items-baseline justify-between gap-2">
        <h2 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Consent / agent traffic</h2>
        <a href="/metrics" class="text-xs text-blue-600 hover:underline dark:text-blue-400">API Metrics</a>
      </div>
      <p class="mb-2 text-xs text-gray-600 dark:text-gray-400">
        Calls made under a Consent, and how many distinct Consents were exercised.
      </p>
      {#if data.tiles.consentTraffic.status === "ok"}
        <div class="divide-y divide-gray-100 dark:divide-gray-700">
          {#each data.tiles.consentTraffic.rows as row (row.key)}
            <div class="py-2" data-testid="dashboard-consent-traffic-{row.key}">
              <div class="flex items-baseline gap-3">
                <div class="w-24 shrink-0 text-xs text-gray-600 dark:text-gray-400">{row.label}</div>
                <div class="text-xl font-semibold" data-testid="dashboard-consent-traffic-{row.key}-value">
                  {formatCount(row.value)}
                </div>
                <div class="text-xs text-gray-600 dark:text-gray-400">
                  {#if row.shareOfTotalPct !== null}
                    {row.shareOfTotalPct >= 10
                      ? Math.round(row.shareOfTotalPct)
                      : row.shareOfTotalPct.toFixed(1)}% of all calls ·
                  {/if}
                  {formatCount(row.activeConsents)} consents
                </div>
                <div class="min-w-0 text-right text-xs" style="margin-left:auto">
                  {@render deltaChip(row, `dashboard-consent-traffic-${row.key}-delta`)}
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        {@render tileProblem(data.tiles.consentTraffic)}
      {/if}
    </div>

    {@render statCard("New users", "dashboard-new-users", "/users", "Users", data.tiles.newUsers, null, (key) => `/system-activity-dashboard/new-users?${windowQuery(key)}`)}
    {@render statCard("New consumers", "dashboard-new-consumers", "/consumers", "Consumers", data.tiles.newConsumers, null, (key) => `/consumers?${windowQuery(key)}`)}
  </div>
</div>
