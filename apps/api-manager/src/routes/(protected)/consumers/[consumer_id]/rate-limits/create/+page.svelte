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
  import { enhance } from "$app/forms";

  let { data, form } = $props();
  const consumer = data.consumer;

  let fromDate = $state("");
  let toDate = $state("");
  let perSecondLimit = $state("1111");
  let perMinuteLimit = $state("2222");
  let perHourLimit = $state("3333");
  let perDayLimit = $state("4444");
  let perWeekLimit = $state("5555");
  let perMonthLimit = $state("6666");
  let bankId = $state("");
  let apiName = $state("");
  let apiVersion = $state("");
  let isSubmitting = $state(false);

  // Set default dates (from today to one year from now)
  $effect(() => {
    if (!fromDate) {
      const now = new Date();
      fromDate = now.toISOString().split("T")[0];
    }
    if (!toDate) {
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      toDate = oneYearFromNow.toISOString().split("T")[0];
    }
  });
</script>

<svelte:head>
  <title>Create Rate Limit - {consumer.app_name}</title>
</svelte:head>

<div class="mb-6">
  <a
    href="/consumers/{consumer.consumer_id}/rate-limits"
    class="text-sm ui-link"
  >
    ← Back to Rate Limits
  </a>
</div>

<h1 class="text-3xl font-bold mb-4 ui-text">
  Create Rate Limit
</h1>

<p class="mb-2 ui-muted">
  Configure rate limits for <strong>{consumer.app_name}</strong> to control API call
  frequency across different time periods.
</p>
<p class="mb-6 text-sm ui-muted">
  Consumer ID: <code class="rounded px-2 py-0.5 ui-panel"
    >{consumer.consumer_id}</code
  >
</p>

{#if form?.error}
  <div
    class="mb-6 rounded-lg border p-4 ui-tone-error"
  >
    <div class="flex items-start">
      <svg
        class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 ui-text-error"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fill-rule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clip-rule="evenodd"
        />
      </svg>
      <div>
        <h3 class="text-sm font-medium ui-text-error">
          Error
        </h3>
        <p class="mt-1 text-sm ui-text-error">
          {form.error}
        </p>
      </div>
    </div>
  </div>
{/if}

<!-- Info Notice -->
<div
  class="mb-6 rounded-lg border p-4 ui-tone-info"
>
  <div class="flex items-start">
    <svg
      class="mr-3 mt-0.5 h-5 w-5 flex-shrink-0 ui-link"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fill-rule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
        clip-rule="evenodd"
      />
    </svg>
    <div>
      <h3 class="text-sm font-medium ui-link">
        Rate Limit Information
      </h3>
      <div class="mt-2 text-sm ui-link">
        <ul class="list-inside list-disc space-y-1">
          <li>
            Rate Limit records are summed for a time period. Use -1 for
            unlimited.
          </li>
        </ul>
      </div>
    </div>
  </div>
</div>

<form
  method="POST"
  use:enhance={() => {
    isSubmitting = true;
    return async ({ update }) => {
      await update();
      isSubmitting = false;
    };
  }}
>
  <div
    class="space-y-6 rounded-lg border p-6 shadow-sm ui-card ui-border"
  >
    <!-- Date Range -->
    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div>
        <label
          for="from_date"
          class="mb-2 block text-sm font-medium ui-text"
        >
          From Date <span class="ui-text-error">*</span>
        </label>
        <input
          type="date"
          id="from_date"
          name="from_date"
          bind:value={fromDate}
          required
          class="w-full rounded-lg border px-4 py-2 focus:ring-2 ui-card ui-text ui-border"
        />
        <p class="mt-1 text-sm ui-muted">
          Start date for this rate limit
        </p>
      </div>

      <div>
        <label
          for="to_date"
          class="mb-2 block text-sm font-medium ui-text"
        >
          To Date <span class="ui-text-error">*</span>
        </label>
        <input
          type="date"
          id="to_date"
          name="to_date"
          bind:value={toDate}
          required
          class="w-full rounded-lg border px-4 py-2 focus:ring-2 ui-card ui-text ui-border"
        />
        <p class="mt-1 text-sm ui-muted">
          End date for this rate limit
        </p>
      </div>
    </div>

    <!-- Rate Limits -->
    <div>
      <h3 class="mb-4 text-lg font-semibold ui-text">
        Rate Limits <span class="text-sm font-normal ui-muted"
          >(at least one required)</span
        >
      </h3>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <!-- Per Second -->
        <div>
          <label
            for="per_second_call_limit"
            class="mb-2 block text-sm font-medium ui-text"
          >
            Per Second
          </label>
          <input
            type="number"
            id="per_second_call_limit"
            name="per_second_call_limit"
            bind:value={perSecondLimit}
            min="0"
            placeholder="Unlimited"
            class="w-full rounded-lg border px-4 py-2 focus:ring-2 ui-card ui-text ui-border"
          />
        </div>

        <!-- Per Minute -->
        <div>
          <label
            for="per_minute_call_limit"
            class="mb-2 block text-sm font-medium ui-text"
          >
            Per Minute
          </label>
          <input
            type="number"
            id="per_minute_call_limit"
            name="per_minute_call_limit"
            bind:value={perMinuteLimit}
            min="0"
            placeholder="Unlimited"
            class="w-full rounded-lg border px-4 py-2 focus:ring-2 ui-card ui-text ui-border"
          />
        </div>

        <!-- Per Hour -->
        <div>
          <label
            for="per_hour_call_limit"
            class="mb-2 block text-sm font-medium ui-text"
          >
            Per Hour
          </label>
          <input
            type="number"
            id="per_hour_call_limit"
            name="per_hour_call_limit"
            bind:value={perHourLimit}
            min="0"
            placeholder="Unlimited"
            class="w-full rounded-lg border px-4 py-2 focus:ring-2 ui-card ui-text ui-border"
          />
        </div>

        <!-- Per Day -->
        <div>
          <label
            for="per_day_call_limit"
            class="mb-2 block text-sm font-medium ui-text"
          >
            Per Day
          </label>
          <input
            type="number"
            id="per_day_call_limit"
            name="per_day_call_limit"
            bind:value={perDayLimit}
            min="0"
            placeholder="Unlimited"
            class="w-full rounded-lg border px-4 py-2 focus:ring-2 ui-card ui-text ui-border"
          />
        </div>

        <!-- Per Week -->
        <div>
          <label
            for="per_week_call_limit"
            class="mb-2 block text-sm font-medium ui-text"
          >
            Per Week
          </label>
          <input
            type="number"
            id="per_week_call_limit"
            name="per_week_call_limit"
            bind:value={perWeekLimit}
            min="0"
            placeholder="Unlimited"
            class="w-full rounded-lg border px-4 py-2 focus:ring-2 ui-card ui-text ui-border"
          />
        </div>

        <!-- Per Month -->
        <div>
          <label
            for="per_month_call_limit"
            class="mb-2 block text-sm font-medium ui-text"
          >
            Per Month
          </label>
          <input
            type="number"
            id="per_month_call_limit"
            name="per_month_call_limit"
            bind:value={perMonthLimit}
            min="0"
            placeholder="Unlimited"
            class="w-full rounded-lg border px-4 py-2 focus:ring-2 ui-card ui-text ui-border"
          />
        </div>
      </div>
    </div>

    <!-- Form Actions -->
    <div
      class="flex items-center justify-end gap-4 border-t pt-6 ui-border"
    >
      <a
        href="/consumers/{consumer.consumer_id}/rate-limits"
        class="rounded-lg border px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 ui-card ui-hover ui-muted ui-border"
      >
        Cancel
      </a>
      <button
        type="submit"
        disabled={isSubmitting}
        class="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed preset-filled-primary-500"
      >
        {#if isSubmitting}
          <svg
            class="mr-2 h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Creating...
        {:else}
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
              d="M5 13l4 4L19 7"
            />
          </svg>
          Create Rate Limit
        {/if}
      </button>
    </div>
  </div>
</form>
