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
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { CircleHelp, Gauge, ShieldAlert, Trash2, Users } from "@lucide/svelte";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import { checkRoles } from "$lib/utils/roleChecker";

  /** One limit row as GET /obp/v7.0.0/management/rate-limiter-config returns it; absent windows are undefined. */
  interface RateLimiterLimit {
    scope: string;
    per_second?: number;
    per_minute?: number;
    per_hour?: number;
    per_day?: number;
    per_week?: number;
    per_month?: number;
    global_per_hour?: number;
    /** Self-service scopes only: the scope's own mode, which can differ from the limiter's. */
    mode?: string;
    /** Self-service scopes only: which endpoints the scope counts. */
    covers?: string;
  }
  interface RateLimiter {
    name: string;
    order: number;
    error_code: string;
    enabled: boolean;
    mode: string;
    keyed_by: string;
    runs: string;
    props_prefix: string;
    limits: RateLimiterLimit[];
  }

  let limiters = $state<RateLimiter[] | null>(null);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  /** One row of GET /obp/v7.0.0/management/rate-limits: a per-consumer override of the consumer limiter. */
  interface ConsumerRateLimit {
    rate_limiting_id: string;
    consumer_id: string;
    consumer_name: string;
    api_version: string | null;
    api_name: string | null;
    bank_id: string | null;
    from_date: string;
    to_date: string;
    is_active: boolean;
    per_second_call_limit: string;
    per_minute_call_limit: string;
    per_hour_call_limit: string;
    per_day_call_limit: string;
    per_week_call_limit: string;
    per_month_call_limit: string;
  }
  const CONSUMER_WINDOWS: { key: keyof ConsumerRateLimit; label: string }[] = [
    { key: "per_second_call_limit", label: "per second" },
    { key: "per_minute_call_limit", label: "per minute" },
    { key: "per_hour_call_limit", label: "per hour" },
    { key: "per_day_call_limit", label: "per day" },
    { key: "per_week_call_limit", label: "per week" },
    { key: "per_month_call_limit", label: "per month" },
  ];

  let consumerLimits = $state<ConsumerRateLimit[] | null>(null);
  let consumerLimitsError = $state<string | null>(null);
  let consumerLimitsForbidden = $state(false);

  /** One row of GET /obp/v7.0.0/management/ip-penalties: an operator's temporary limit on one address. */
  interface IpPenalty {
    ip_address: string;
    per_minute_limit: number;
    reason: string;
    created_by_user_id: string;
    created_at: string;
    expires_at: string;
  }

  let penalties = $state<IpPenalty[] | null>(null);
  let penaltiesError = $state<string | null>(null);
  let penaltiesForbidden = $state(false);
  let penaltyForm = $state({ ip_address: "", per_minute_limit: "10", duration_minutes: "60", reason: "" });
  let penaltySubmitError = $state<string | null>(null);
  let penaltySubmitting = $state(false);

  function holdsSystemRole(role: string): boolean {
    return checkRoles(page.data.userEntitlements ?? [], [{ role }], undefined, "OR", page.data.jitEnabled ?? false).hasAllRoles;
  }
  let canCreatePenalty = $derived(holdsSystemRole("CanCreateIpPenalty"));
  let canDeletePenalty = $derived(holdsSystemRole("CanDeleteIpPenalty"));

  async function fetchPenalties() {
    penaltiesError = null;
    penaltiesForbidden = false;
    try {
      const response = await fetch("/proxy/obp/v7.0.0/management/ip-penalties");
      if (response.status === 403) {
        penaltiesForbidden = true;
        penalties = null;
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Failed to fetch IP penalties (${response.status}): ${data.message}`);
      penalties = data.ip_penalties;
    } catch (err) {
      penaltiesError = err instanceof Error ? err.message : "Failed to fetch IP penalties";
      penalties = null;
    }
  }

  async function addPenalty(event: SubmitEvent) {
    event.preventDefault();
    penaltySubmitError = null;
    penaltySubmitting = true;
    try {
      const response = await fetch("/proxy/obp/v7.0.0/management/ip-penalties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ip_address: penaltyForm.ip_address.trim(),
          per_minute_limit: Number(penaltyForm.per_minute_limit),
          duration_minutes: Number(penaltyForm.duration_minutes),
          reason: penaltyForm.reason.trim(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? `Failed to add the penalty (${response.status})`);
      penaltyForm = { ip_address: "", per_minute_limit: "10", duration_minutes: "60", reason: "" };
      await fetchPenalties();
    } catch (err) {
      penaltySubmitError = err instanceof Error ? err.message : "Failed to add the penalty";
    } finally {
      penaltySubmitting = false;
    }
  }

  async function removePenalty(ipAddress: string) {
    penaltySubmitError = null;
    const response = await fetch(`/proxy/obp/v7.0.0/management/ip-penalties/${encodeURIComponent(ipAddress)}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) {
      const data = await response.json().catch(() => ({}));
      penaltySubmitError = data.message ?? `Failed to remove the penalty (${response.status})`;
    }
    await fetchPenalties();
  }

  async function fetchConsumerLimits() {
    consumerLimitsError = null;
    consumerLimitsForbidden = false;
    try {
      const response = await fetch("/proxy/obp/v7.0.0/management/rate-limits");
      if (response.status === 403) {
        consumerLimitsForbidden = true;
        consumerLimits = null;
        return;
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch consumer rate limits (${response.status}): ${errorData.message}`);
      }
      const data = await response.json();
      if (data.message) throw new Error(data.message);
      consumerLimits = data.rate_limits ?? [];
    } catch (err) {
      consumerLimitsError = err instanceof Error ? err.message : "Failed to fetch consumer rate limits";
      consumerLimits = null;
    }
  }

  /** What a row narrows to: an endpoint, a bank, or every call the consumer makes. */
  function scopeOf(limit: ConsumerRateLimit): string {
    const parts = [
      limit.api_version && limit.api_name ? `${limit.api_version} ${limit.api_name}` : limit.api_name || limit.api_version,
      limit.bank_id ? `bank ${limit.bank_id}` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "all calls";
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
  }

  const WINDOWS: { key: keyof RateLimiterLimit; label: string }[] = [
    { key: "per_second", label: "per second" },
    { key: "per_minute", label: "per minute" },
    { key: "per_hour", label: "per hour" },
    { key: "per_day", label: "per day" },
    { key: "per_week", label: "per week" },
    { key: "per_month", label: "per month" },
    { key: "global_per_hour", label: "global per hour" },
  ];

  const TITLES: Record<string, string> = {
    self_service: "Self-service",
    authentication: "Authentication",
    consumer: "Consumer quota",
  };

  async function fetchLimiters() {
    try {
      isLoading = true;
      error = null;
      const response = await fetch("/proxy/obp/v7.0.0/management/rate-limiter-config");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch rate limiters (${response.status}): ${errorData.message}`);
      }
      const data = await response.json();
      if (data.message) throw new Error(data.message);
      limiters = [...data.rate_limiters].sort((a, b) => a.order - b.order);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to fetch rate limiters";
    } finally {
      isLoading = false;
    }
  }

  /** Which windows at least one row of this limiter reports, so the table shows only its own columns. */
  function windowsOf(limiter: RateLimiter) {
    return WINDOWS.filter((w) => limiter.limits.some((l) => l[w.key] !== undefined));
  }

  function formatLimit(value: number | undefined): string {
    if (value === undefined) return "";
    if (value === -1) return "unlimited";
    if (value === 0) return "blocked";
    return String(value);
  }

  function refresh() {
    fetchLimiters();
    fetchConsumerLimits();
    fetchPenalties();
    // Arriving from the Telemetry page's "Penalise" link: fill in the address.
    const penalise = new URLSearchParams(window.location.search).get("penalise");
    if (penalise !== null) penaltyForm.ip_address = penalise;
  }

  onMount(refresh);
</script>

<svelte:head>
  <title>Rate Limiting - API Manager II</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6 flex items-center justify-between">
    <div>
      <h1 class="flex items-center gap-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
        <Gauge size={28} /> Rate Limiting
      </h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        The three rate limiters on this OBP instance, in the order a request meets them.
      </p>
    </div>
    <div class="flex items-center gap-2">
      <a
        href="/system/rate-limiting/help"
        class="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        data-testid="rate-limiting-help-link"
      >
        <CircleHelp size={16} /> Help
      </a>
      <button
        onclick={refresh}
        disabled={isLoading}
        class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        data-testid="refresh-rate-limiters"
      >
        {isLoading ? "Refreshing..." : "Refresh"}
      </button>
    </div>
  </div>

  {#if error}
    <div
      class="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
      data-testid="rate-limiters-error"
    >
      <strong>Error:</strong>
      {error}
    </div>
  {:else if isLoading && !limiters}
    <div class="flex items-center justify-center rounded-lg bg-gray-100 p-8 dark:bg-gray-800">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      <p class="ml-3 text-gray-700 dark:text-gray-300">Loading rate limiters...</p>
    </div>
  {:else if limiters}
    <div class="space-y-6">
      {#each limiters as limiter (limiter.name)}
        <section
          class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
          data-testid="rate-limiter-{limiter.name}"
          data-state={limiter.enabled ? "enabled" : "disabled"}
        >
          <div class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 p-6 dark:border-gray-700">
            <div>
              <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {limiter.order}. {TITLES[limiter.name]}
              </h2>
              <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Runs {limiter.runs}. Keyed by {limiter.keyed_by}.
              </p>
            </div>
            <dl class="grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
              <dt class="text-gray-500 dark:text-gray-400">Enabled</dt>
              <dt class="text-gray-500 dark:text-gray-400">Mode</dt>
              <dt class="text-gray-500 dark:text-gray-400">429 code</dt>
              <dd
                class="font-medium {limiter.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}"
                data-testid="rate-limiter-{limiter.name}-enabled"
              >
                {limiter.enabled ? "yes" : "no"}
              </dd>
              <dd
                class="font-medium {limiter.mode === 'enforce' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}"
                data-testid="rate-limiter-{limiter.name}-mode"
              >
                {limiter.mode}
              </dd>
              <dd class="font-mono text-gray-900 dark:text-gray-100" data-testid="rate-limiter-{limiter.name}-code">
                {limiter.error_code}
              </dd>
            </dl>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-sm" data-testid="rate-limiter-{limiter.name}-limits">
              <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
                <tr>
                  <th class="px-6 py-3">Scope</th>
                  {#if limiter.limits.some((l) => l.mode !== undefined)}
                    <th class="px-6 py-3">Mode</th>
                  {/if}
                  {#each windowsOf(limiter) as w (w.key)}
                    <th class="px-6 py-3 text-right">{w.label}</th>
                  {/each}
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                {#each limiter.limits as limit (limit.scope)}
                  <tr data-testid="rate-limiter-{limiter.name}-limit-{limit.scope}">
                    <td class="px-6 py-3 align-top">
                      <span class="font-mono text-gray-900 dark:text-gray-100">{limit.scope}</span>
                      {#if limit.covers !== undefined}
                        <p class="mt-1 max-w-xl text-xs text-gray-500 dark:text-gray-400" data-testid="rate-limiter-{limiter.name}-limit-{limit.scope}-covers">
                          {limit.covers}
                        </p>
                      {/if}
                    </td>
                    {#if limiter.limits.some((l) => l.mode !== undefined)}
                      <td
                        class="px-6 py-3 align-top font-medium {limit.mode === 'enforce' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}"
                        data-testid="rate-limiter-{limiter.name}-limit-{limit.scope}-mode"
                      >
                        {limit.mode ?? limiter.mode}
                      </td>
                    {/if}
                    {#each windowsOf(limiter) as w (w.key)}
                      <td class="px-6 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {formatLimit(limit[w.key] as number | undefined)}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <p class="px-6 py-3 text-xs text-gray-500 dark:text-gray-400">
            Props prefix <code class="font-mono">{limiter.props_prefix}</code>. -1 is unlimited, 0 blocks every call.
          </p>

          {#if limiter.name === "consumer"}
            <div class="border-t border-gray-200 dark:border-gray-700" data-testid="consumer-rate-limits">
              <div class="flex flex-wrap items-center justify-between gap-2 px-6 pt-5 pb-3">
                <div>
                  <h3 class="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
                    <Users size={18} /> Per-consumer rate limits
                  </h3>
                  <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Rows set on individual Consumers. A Consumer with none uses <code class="font-mono">consumer_default</code> above.
                  </p>
                </div>
                <a
                  href="/consumers"
                  class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  data-testid="consumer-rate-limits-consumers-link"
                >
                  Manage per Consumer
                </a>
              </div>

              {#if consumerLimitsForbidden}
                <div class="px-6 pb-5" data-testid="consumer-rate-limits-forbidden">
                  <MissingRoleAlert roles={["CanReadCallLimits"]} message="You need this role to list the per-consumer rows" />
                </div>
              {:else if consumerLimitsError}
                <p class="px-6 pb-5 text-sm text-red-700 dark:text-red-400" data-testid="consumer-rate-limits-error">
                  {consumerLimitsError}
                </p>
              {:else if consumerLimits === null}
                <p class="px-6 pb-5 text-sm text-gray-500 dark:text-gray-400">Loading per-consumer rate limits...</p>
              {:else if consumerLimits.length === 0}
                <p class="px-6 pb-5 text-sm text-gray-500 dark:text-gray-400" data-testid="consumer-rate-limits-empty">
                  No Consumer has its own rate limit rows. Every Consumer is on the defaults above.
                </p>
              {:else}
                <div class="overflow-x-auto">
                  <table class="w-full text-sm" data-testid="consumer-rate-limits-table">
                    <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
                      <tr>
                        <th class="px-6 py-3">Consumer</th>
                        <th class="px-6 py-3">Scope</th>
                        <th class="px-6 py-3">Valid</th>
                        {#each CONSUMER_WINDOWS as w (w.key)}
                          <th class="px-6 py-3 text-right">{w.label}</th>
                        {/each}
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                      {#each consumerLimits as limit (limit.rate_limiting_id)}
                        <tr
                          class={limit.is_active ? "" : "text-gray-400 dark:text-gray-500"}
                          data-testid="consumer-rate-limit-{limit.rate_limiting_id}"
                          data-state={limit.is_active ? "active" : "inactive"}
                        >
                          <td class="px-6 py-3">
                            <a
                              href="/consumers/{limit.consumer_id}/rate-limits"
                              class="font-medium text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {limit.consumer_name || "(unnamed)"}
                            </a>
                            <div class="font-mono text-xs text-gray-500 dark:text-gray-400">{limit.consumer_id}</div>
                          </td>
                          <td class="px-6 py-3 text-gray-700 dark:text-gray-300">{scopeOf(limit)}</td>
                          <td class="px-6 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                            {formatDate(limit.from_date)} to {formatDate(limit.to_date)}
                            {#if limit.is_active}
                              <span class="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">active</span>
                            {/if}
                          </td>
                          {#each CONSUMER_WINDOWS as w (w.key)}
                            <td class="px-6 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                              {formatLimit(Number(limit[w.key]))}
                            </td>
                          {/each}
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </div>
          {/if}
        </section>
      {/each}
    </div>
  {/if}
  <!-- IP penalties: an operator's temporary per-minute limit on one address, on every endpoint -->
  <section
    class="mt-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
    id="ip-penalties"
    data-testid="ip-penalties"
  >
    <div class="px-6 pt-5 pb-3">
      <h2 class="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        <ShieldAlert size={20} /> Penalised addresses
      </h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        A penalty limits one IP address to a number of requests per minute on every endpoint, until it expires, and
        is checked before all the limiters above. 0 refuses every request (429 <code class="font-mono">OBP-10062</code>).
        Penalties are shared by every instance and disappear when they expire.
      </p>
    </div>

    {#if !canCreatePenalty}
      <div class="px-6 pb-4" data-testid="ip-penalty-create-forbidden">
        <MissingRoleAlert roles={["CanCreateIpPenalty"]} message="You need this role to add a penalty" />
      </div>
    {:else}
      <form class="flex flex-wrap items-end gap-3 px-6 pb-4" onsubmit={addPenalty} data-testid="ip-penalty-form">
        <label class="text-sm text-gray-700 dark:text-gray-300">
          IP address
          <input name="ip_address" required bind:value={penaltyForm.ip_address} placeholder="203.0.113.42"
            class="mt-1 block w-44 rounded-md border border-gray-300 px-2 py-1.5 font-mono text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            data-testid="ip-penalty-ip-address" />
        </label>
        <label class="text-sm text-gray-700 dark:text-gray-300">
          Per minute
          <input name="per_minute_limit" type="number" min="0" required bind:value={penaltyForm.per_minute_limit}
            class="mt-1 block w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            data-testid="ip-penalty-per-minute-limit" />
        </label>
        <label class="text-sm text-gray-700 dark:text-gray-300">
          Minutes
          <input name="duration_minutes" type="number" min="1" max="10080" required bind:value={penaltyForm.duration_minutes}
            class="mt-1 block w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            data-testid="ip-penalty-duration-minutes" />
        </label>
        <label class="grow text-sm text-gray-700 dark:text-gray-300">
          Reason
          <input name="reason" required maxlength="255" bind:value={penaltyForm.reason}
            class="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            data-testid="ip-penalty-reason" />
        </label>
        <button type="submit" disabled={penaltySubmitting}
          class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          data-testid="ip-penalty-add" data-state={penaltySubmitting ? "submitting" : "idle"}>
          Add penalty
        </button>
      </form>
    {/if}
    {#if penaltySubmitError}
      <p class="px-6 pb-3 text-sm text-red-700 dark:text-red-400" data-testid="ip-penalty-submit-error">{penaltySubmitError}</p>
    {/if}

    {#if penaltiesForbidden}
      <div class="px-6 pb-5" data-testid="ip-penalties-forbidden">
        <MissingRoleAlert roles={["CanGetIpPenalties"]} message="You need this role to list penalised addresses" />
      </div>
    {:else}
      {#if penaltiesError}
        <p class="px-6 pb-5 text-sm text-red-700 dark:text-red-400" data-testid="ip-penalties-error">{penaltiesError}</p>
      {:else if penalties === null}
        <p class="px-6 pb-5 text-sm text-gray-500 dark:text-gray-400">Loading IP penalties...</p>
      {:else if penalties.length === 0}
        <p class="px-6 pb-5 text-sm text-gray-500 dark:text-gray-400" data-testid="ip-penalties-empty">No address has a penalty.</p>
      {:else}
        <div class="overflow-x-auto">
          <table class="w-full text-sm" data-testid="ip-penalties-table">
            <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
              <tr>
                <th class="px-6 py-3">Address</th>
                <th class="px-6 py-3 text-right">Per minute</th>
                <th class="px-6 py-3">Expires</th>
                <th class="px-6 py-3">Reason</th>
                <th class="px-6 py-3">Set by</th>
                <th class="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
              {#each penalties as penalty (penalty.ip_address)}
                <tr data-testid="ip-penalty-{penalty.ip_address}">
                  <td class="px-6 py-3 font-mono text-gray-900 dark:text-gray-100">{penalty.ip_address}</td>
                  <td class="px-6 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{penalty.per_minute_limit}</td>
                  <td class="px-6 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">{formatDate(penalty.expires_at)}</td>
                  <td class="px-6 py-3 text-gray-700 dark:text-gray-300">{penalty.reason}</td>
                  <td class="px-6 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{penalty.created_by_user_id}</td>
                  <td class="px-6 py-3 text-right">
                    {#if canDeletePenalty}
                      <button type="button" onclick={() => removePenalty(penalty.ip_address)}
                        class="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                        aria-label="Remove the penalty on {penalty.ip_address}"
                        data-testid="ip-penalty-remove-{penalty.ip_address}">
                        <Trash2 size={14} /> Remove
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        {#if !canDeletePenalty}
          <div class="px-6 py-4" data-testid="ip-penalty-delete-forbidden">
            <MissingRoleAlert roles={["CanDeleteIpPenalty"]} message="You need this role to remove a penalty" />
          </div>
        {/if}
      {/if}
    {/if}
  </section>
</div>
