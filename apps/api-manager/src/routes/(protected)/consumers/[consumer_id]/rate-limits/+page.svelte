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
  let { data } = $props();
  const consumer = data.consumer;
  const rateLimits = data.rateLimits;
  const callCounters = data.callCounters;
  const activeRateLimits = data.activeRateLimits;
  const rateLimitingInfo = data.rateLimitingInfo;

  // Debug logging
  console.log("Call Counters Data:", callCounters);
  console.log("Active Rate Limits:", activeRateLimits);

  function formatShortDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Unknown";
    }
  }

  function formatFullDateTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "Unknown";
    }
  }

  function isLimitActive(limit: any): boolean {
    const now = new Date();
    const fromDate = new Date(limit.from_date);
    const toDate = new Date(limit.to_date);
    return now >= fromDate && now <= toDate;
  }

  function formatNumber(value: string | number | undefined): string {
    if (value === undefined || value === null || value === "") {
      return "formatNumber Undefined";
    }
    const num = typeof value === "string" ? parseInt(value, 10) : value;
    if (isNaN(num) || num < 0) {
      return "formatNumber Undefined 2";
    }
    return num.toLocaleString();
  }

  function getUsagePercentage(used: number, limit: string | number): number {
    const limitNum = typeof limit === "string" ? parseInt(limit, 10) : limit;
    if (isNaN(limitNum) || limitNum <= 0) {
      return 0;
    }
    return Math.min((used / limitNum) * 100, 100);
  }

  function getUsageColor(percentage: number): string {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-orange-500";
    if (percentage >= 50) return "bg-yellow-500";
    return "bg-green-500";
  }

  function formatUsageValue(usageData: any, period: string): string {
    // If we got an ERROR from the API, don't lie with fake data
    if (usageData === "ERROR") {
      return "UNKNOWN";
    }
    const value = usageData[period];
    if (value === undefined || value === null) {
      return "UNKNOWN";
    }
    // Handle nested object structure with calls_made property
    if (typeof value === "object" && value.calls_made !== undefined) {
      return String(value.calls_made);
    }
    // Handle simple numeric value (legacy format)
    if (typeof value === "number") {
      return String(value);
    }
    return "UNKNOWN";
  }

  function getCallsMade(usageData: any, period: string): number {
    // If we got an ERROR from the API, return 0 but shouldn't be used anyway
    if (usageData === "ERROR") {
      return 0;
    }
    const value = usageData[period];
    if (value === undefined || value === null) {
      return 0;
    }
    // Handle nested object structure with calls_made property
    if (typeof value === "object" && value.calls_made !== undefined) {
      return value.calls_made;
    }
    // Handle simple numeric value (legacy format)
    if (typeof value === "number") {
      return value;
    }
    return 0;
  }

  function isUsageActive(usageData: any, period: string): boolean {
    // If we got an ERROR from the API, it's not active
    if (usageData === "ERROR") {
      return false;
    }
    const value = usageData[period];
    if (value === undefined || value === null) {
      return false;
    }
    // Handle nested object structure
    if (typeof value === "object" && value.status !== undefined) {
      return value.status === "ACTIVE";
    }
    // Handle simple numeric value
    return true;
  }
</script>

<svelte:head>
  <title>Rate Limits - {consumer.app_name}</title>
</svelte:head>

<div class="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
  <a
    href="/consumers"
    class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
  >
    ← Back to Consumers
  </a>
  <a
    href="/system/rate-limiting"
    class="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
    data-testid="system-rate-limiting-link"
  >
    Instance rate limiters and all consumers' limits
  </a>
</div>

<!-- Consumer Header -->
<div class="mb-6">
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Rate Limits: {consumer.app_name}
      </h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Consumer ID: <code
          class="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-900"
          >{consumer.consumer_id}</code
        >
      </p>
    </div>
    <div class="flex items-center gap-2">
      <span
        class="rounded-full px-3 py-1 text-xs font-medium {consumer.enabled
          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}"
      >
        {consumer.enabled ? "Enabled" : "Disabled"}
      </span>
      <span
        class="rounded-full px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      >
        {consumer.app_type}
      </span>
    </div>
  </div>

  <!-- Caching Information -->
  <div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
    <svg
      class="inline-block mr-1 h-4 w-4"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fill-rule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clip-rule="evenodd"
      />
    </svg>
    Note: Rate limit records and active rate limits are cached for up to an hour.
  </div>
</div>

<!-- Rate Limiting System Status -->
{#if rateLimitingInfo}
  <div
    class="mb-4 rounded-lg border p-3 {rateLimitingInfo.enabled &&
    rateLimitingInfo.is_active
      ? 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
      : 'border-yellow-200 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20'}"
  >
    <div class="flex items-start gap-3">
      <svg
        class="h-5 w-5 flex-shrink-0 {rateLimitingInfo.enabled &&
        rateLimitingInfo.is_active
          ? 'text-green-600 dark:text-green-400'
          : 'text-yellow-600 dark:text-yellow-400'}"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fill-rule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
          clip-rule="evenodd"
        />
      </svg>
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <h3
            class="text-sm font-medium {rateLimitingInfo.enabled &&
            rateLimitingInfo.is_active
              ? 'text-green-900 dark:text-green-100'
              : 'text-yellow-900 dark:text-yellow-100'}"
          >
            Rate Limiting System Status
          </h3>
          <span
            class="rounded-full px-2 py-0.5 text-xs font-medium {rateLimitingInfo.enabled &&
            rateLimitingInfo.is_active
              ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300'}"
          >
            {rateLimitingInfo.enabled && rateLimitingInfo.is_active
              ? "Active"
              : "Inactive"}
          </span>
        </div>
        <div
          class="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs {rateLimitingInfo.enabled &&
          rateLimitingInfo.is_active
            ? 'text-green-800 dark:text-green-200'
            : 'text-yellow-800 dark:text-yellow-200'}"
        >
          <div>
            <span class="font-medium">Enabled:</span>
            {rateLimitingInfo.enabled ? "Yes" : "No"}
          </div>
          <div>
            <span class="font-medium">Active:</span>
            {rateLimitingInfo.is_active ? "Yes" : "No"}
          </div>
          <div>
            <span class="font-medium">Service Available:</span>
            {rateLimitingInfo.service_available ? "Yes" : "No"}
          </div>
          <div>
            <span class="font-medium">Technology:</span>
            {rateLimitingInfo.technology || "N/A"}
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Current Usage Card -->
<div
  class="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-6 dark:border-blue-700 dark:bg-blue-900/20"
>
  <div class="mb-4 flex items-center justify-between">
    <h2 class="text-lg font-semibold text-blue-900 dark:text-blue-100">
      Call Counters / Active Limits
    </h2>
    {#if activeRateLimits}
      <div class="text-sm text-blue-800 dark:text-blue-200">
        Active as of {formatFullDateTime(activeRateLimits.active_at_date)}
      </div>
    {/if}
  </div>

  <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
    <!-- Per Second -->
    <div>
      <div class="mb-1 text-xs text-blue-700 dark:text-blue-300">
        Per Second
      </div>
      <div class="text-sm font-medium text-blue-900 dark:text-blue-100">
        {formatUsageValue(callCounters, "per_second")}
        {#if activeRateLimits && activeRateLimits.active_per_second_rate_limit > 0}
          / {formatNumber(activeRateLimits.active_per_second_rate_limit)}
        {:else}
          / <span class="text-gray-500 dark:text-gray-400">Unlimited</span>
        {/if}
      </div>
    </div>

    <!-- Per Minute -->
    <div>
      <div class="mb-1 text-xs text-blue-700 dark:text-blue-300">
        Per Minute
      </div>
      <div class="text-sm font-medium text-blue-900 dark:text-blue-100">
        {formatUsageValue(callCounters, "per_minute")}
        {#if activeRateLimits && activeRateLimits.active_per_minute_rate_limit > 0}
          / {formatNumber(activeRateLimits.active_per_minute_rate_limit)}
        {:else}
          / <span class="text-gray-500 dark:text-gray-400">Unlimited</span>
        {/if}
      </div>
    </div>

    <!-- Per Hour -->
    <div>
      <div class="mb-1 text-xs text-blue-700 dark:text-blue-300">Per Hour</div>
      <div class="text-sm font-medium text-blue-900 dark:text-blue-100">
        {formatUsageValue(callCounters, "per_hour")}
        {#if activeRateLimits && activeRateLimits.active_per_hour_rate_limit > 0}
          / {formatNumber(activeRateLimits.active_per_hour_rate_limit)}
        {:else}
          / <span class="text-gray-500 dark:text-gray-400">Unlimited</span>
        {/if}
      </div>
    </div>

    <!-- Per Day -->
    <div>
      <div class="mb-1 text-xs text-blue-700 dark:text-blue-300">Per Day</div>
      <div class="text-sm font-medium text-blue-900 dark:text-blue-100">
        {formatUsageValue(callCounters, "per_day")}
        {#if activeRateLimits && activeRateLimits.active_per_day_rate_limit > 0}
          / {formatNumber(activeRateLimits.active_per_day_rate_limit)}
        {:else}
          / <span class="text-gray-500 dark:text-gray-400">Unlimited</span>
        {/if}
      </div>
    </div>

    <!-- Per Week -->
    <div>
      <div class="mb-1 text-xs text-blue-700 dark:text-blue-300">Per Week</div>
      <div class="text-sm font-medium text-blue-900 dark:text-blue-100">
        {formatUsageValue(callCounters, "per_week")}
        {#if activeRateLimits && activeRateLimits.active_per_week_rate_limit > 0}
          / {formatNumber(activeRateLimits.active_per_week_rate_limit)}
        {:else}
          / <span class="text-gray-500 dark:text-gray-400">Unlimited</span>
        {/if}
      </div>
    </div>

    <!-- Per Month -->
    <div>
      <div class="mb-1 text-xs text-blue-700 dark:text-blue-300">Per Month</div>
      <div class="text-sm font-medium text-blue-900 dark:text-blue-100">
        {formatUsageValue(callCounters, "per_month")}
        {#if activeRateLimits && activeRateLimits.active_per_month_rate_limit > 0}
          / {formatNumber(activeRateLimits.active_per_month_rate_limit)}
        {:else}
          / <span class="text-gray-500 dark:text-gray-400">Unlimited</span>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Rate Limits Section -->
<div
  class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
>
  <div class="mb-4 flex items-center justify-between">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
      Rate Limit Records
      {#if rateLimits.length > 0}
        <span class="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
          ({rateLimits.length})
        </span>
      {/if}
    </h2>
    <a
      href="/consumers/{consumer.consumer_id}/rate-limits/create"
      class="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
    >
      <svg
        class="mr-1.5 h-4 w-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
        />
      </svg>
      Create Rate Limit
    </a>
  </div>

  {#if rateLimits.length > 0}
    <div class="space-y-3">
      {#each rateLimits as limit (limit.rate_limiting_id)}
        <div
          class="rounded-lg border p-4 {isLimitActive(limit)
            ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/30'
            : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50'}"
        >
          <div class="mb-3 flex items-start justify-between">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-600 dark:text-gray-400">
                  Rate Limit ID: {limit.rate_limiting_id}
                </span>
                {#if isLimitActive(limit)}
                  <span
                    class="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  >
                    Active
                  </span>
                {/if}
              </div>
              <div class="mt-1 text-xs text-gray-500 dark:text-gray-500">
                Valid: {formatShortDate(limit.from_date)} → {formatShortDate(
                  limit.to_date,
                )}
              </div>
            </div>
            <div class="flex gap-2">
              <a
                href="/consumers/{consumer.consumer_id}/rate-limits/{limit.rate_limiting_id}/edit"
                class="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Edit
              </a>
              <a
                href="/consumers/{consumer.consumer_id}/rate-limits/{limit.rate_limiting_id}/delete"
                class="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Delete
              </a>
            </div>
          </div>

          <div
            class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6"
          >
            <div>
              <div class="text-gray-600 dark:text-gray-400">Per Second</div>
              <div class="font-medium text-gray-900 dark:text-gray-100">
                {formatNumber(limit.per_second_call_limit)}
              </div>
            </div>
            <div>
              <div class="text-gray-600 dark:text-gray-400">Per Minute</div>
              <div class="font-medium text-gray-900 dark:text-gray-100">
                {formatNumber(limit.per_minute_call_limit)}
              </div>
            </div>
            <div>
              <div class="text-gray-600 dark:text-gray-400">Per Hour</div>
              <div class="font-medium text-gray-900 dark:text-gray-100">
                {formatNumber(limit.per_hour_call_limit)}
              </div>
            </div>
            <div>
              <div class="text-gray-600 dark:text-gray-400">Per Day</div>
              <div class="font-medium text-gray-900 dark:text-gray-100">
                {formatNumber(limit.per_day_call_limit)}
              </div>
            </div>
            <div>
              <div class="text-gray-600 dark:text-gray-400">Per Week</div>
              <div class="font-medium text-gray-900 dark:text-gray-100">
                {formatNumber(limit.per_week_call_limit)}
              </div>
            </div>
            <div>
              <div class="text-gray-600 dark:text-gray-400">Per Month</div>
              <div class="font-medium text-gray-900 dark:text-gray-100">
                {formatNumber(limit.per_month_call_limit)}
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="rounded-lg bg-gray-100 p-8 text-center dark:bg-gray-900/50">
      <svg
        class="mx-auto mb-4 h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        No rate limits configured
      </p>
      <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Create a rate limit to control API call frequency for this consumer.
      </p>
      <a
        href="/consumers/{consumer.consumer_id}/rate-limits/create"
        class="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        <svg
          class="mr-2 h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v16m8-8H4"
          />
        </svg>
        Create Rate Limit
      </a>
    </div>
  {/if}
</div>
