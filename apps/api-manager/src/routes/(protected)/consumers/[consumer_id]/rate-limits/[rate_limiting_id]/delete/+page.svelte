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
  const rateLimit = data.rateLimit;

  let isSubmitting = $state(false);

  function formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "Unknown date";
    }
  }

  function formatLimitValue(value: string | number): string {
    const num = typeof value === "string" ? parseInt(value, 10) : value;
    if (isNaN(num) || num <= 0) {
      return "Unlimited";
    }
    return num.toLocaleString();
  }
</script>

<svelte:head>
  <title>Delete Rate Limit - {consumer.app_name}</title>
</svelte:head>

  <div class="mb-6">
    <a
      href="/consumers/{consumer.consumer_id}/rate-limits"
      class="text-sm ui-link"
    >
      ← Back to Rate Limits
    </a>
  </div>

  <h1 class="text-2xl font-bold mb-2 ui-text">
    Delete Rate Limit
  </h1>

  <p class="mb-6 ui-muted">
    Are you sure you want to delete this rate limit for <strong
      >{consumer.app_name}</strong
    >?
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

  <!-- Warning Notice -->
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
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clip-rule="evenodd"
        />
      </svg>
      <div>
        <h3 class="text-sm font-medium ui-text-error">
          Are you sure you want to delete this record?
        </h3>
      </div>
    </div>
  </div>

  <!-- Rate Limit Details -->
  <div
    class="mb-6 rounded-lg border p-6 shadow-sm ui-card ui-border"
  >
    <h2 class="mb-4 text-lg font-semibold ui-text">
      Rate Limit Details
    </h2>

    <div class="space-y-3 text-sm">
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
        <span class="font-medium ui-muted"
          >Consumer:</span
        >
        <span class="sm:col-span-2 ui-text"
          >{consumer.app_name}</span
        >
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
        <span class="font-medium ui-muted"
          >Consumer ID:</span
        >
        <span class="sm:col-span-2 font-mono ui-text"
          >{consumer.consumer_id}</span
        >
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
        <span class="font-medium ui-muted"
          >Rate Limit ID:</span
        >
        <span class="sm:col-span-2 font-mono ui-text"
          >{rateLimit.rate_limiting_id}</span
        >
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
        <span class="font-medium ui-muted"
          >Valid Period:</span
        >
        <span class="sm:col-span-2 ui-text">
          {formatDate(rateLimit.from_date)} → {formatDate(rateLimit.to_date)}
        </span>
      </div>

      <div class="mt-4 pt-4 border-t ui-border">
        <h3 class="mb-2 font-medium ui-text">
          Current Limits:
        </h3>
        <div class="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div>
            <div class="ui-muted">Per Second</div>
            <div class="font-medium ui-text">
              {formatLimitValue(rateLimit.per_second_call_limit)}
            </div>
          </div>
          <div>
            <div class="ui-muted">Per Minute</div>
            <div class="font-medium ui-text">
              {formatLimitValue(rateLimit.per_minute_call_limit)}
            </div>
          </div>
          <div>
            <div class="ui-muted">Per Hour</div>
            <div class="font-medium ui-text">
              {formatLimitValue(rateLimit.per_hour_call_limit)}
            </div>
          </div>
          <div>
            <div class="ui-muted">Per Day</div>
            <div class="font-medium ui-text">
              {formatLimitValue(rateLimit.per_day_call_limit)}
            </div>
          </div>
          <div>
            <div class="ui-muted">Per Week</div>
            <div class="font-medium ui-text">
              {formatLimitValue(rateLimit.per_week_call_limit)}
            </div>
          </div>
          <div>
            <div class="ui-muted">Per Month</div>
            <div class="font-medium ui-text">
              {formatLimitValue(rateLimit.per_month_call_limit)}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Confirmation Form -->
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
    <div class="flex gap-3">
      <button
        type="submit"
        disabled={isSubmitting}
        class="inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-medium focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 preset-filled-error-500"
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
          Deleting...
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Delete Rate Limit
        {/if}
      </button>

      <a
        href="/consumers/{consumer.consumer_id}/rate-limits"
        class="inline-flex items-center rounded-lg border px-5 py-2.5 text-sm font-medium focus:outline-none focus:ring-4 ui-card ui-hover ui-muted ui-border"
      >
        Cancel
      </a>
    </div>
  </form>
