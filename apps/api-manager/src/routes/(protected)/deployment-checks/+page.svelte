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
  import { AlertTriangle, CheckCircle2, CircleHelp, Info, RefreshCw, XCircle } from "@lucide/svelte";

  /** One check as GET /obp/v7.0.0/management/system/diagnostics/deployment returns it. */
  interface DeploymentCheck {
    id: string;
    title: string;
    area: string;
    basis: "observed" | "configured" | "manual";
    status: "OK" | "INFO" | "WARNING" | "ERROR" | "MANUAL";
    message: string;
    evidence: { name: string; value: string }[];
    props: string[];
  }
  interface DeploymentChecks {
    api_instance_id: string;
    checked_at: string;
    window_minutes: number;
    errors: number;
    warnings: number;
    checks: DeploymentCheck[];
  }

  let { data }: { data: PageData } = $props();

  const deployment = $derived(data.deployment as DeploymentChecks | null);
  const areas = $derived(deployment ? [...new Set(deployment.checks.map((c) => c.area))] : []);
  let refreshing = $state(false);

  async function refresh() {
    refreshing = true;
    try {
      await invalidate("app:deployment-checks");
    } finally {
      refreshing = false;
    }
  }

  const basisLabels: Record<string, string> = {
    observed: "from traffic",
    configured: "from props",
    manual: "check by hand",
  };

  function statusBadge(status: string): string {
    if (status === "OK") return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
    if (status === "WARNING") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
    if (status === "ERROR") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    if (status === "MANUAL") return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    return "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300";
  }
</script>

<svelte:head>
  <title>Deployment Checks - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8" data-testid="deployment-checks-page">
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Deployment Checks</h1>
      <p class="mt-1 max-w-3xl text-gray-600 dark:text-gray-400">
        Whether this OBP-API instance, and the proxy and applications in front of it, are set up so that per-IP
        limits, IP penalties and the busiest-callers view see real client addresses. Worked out from its props
        and its traffic of the last few minutes.
      </p>
    </div>
    {#if data.hasRole}
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        onclick={refresh}
        disabled={refreshing}
        data-testid="deployment-checks-refresh"
        data-state={refreshing ? "refreshing" : "idle"}
      >
        <RefreshCw class="h-4 w-4 {refreshing ? 'animate-spin' : ''}" />
        Check again
      </button>
    {/if}
  </div>

  {#if !data.hasRole}
    <MissingRoleAlert roles={["CanGetConfig"]} message="You need this role to run the Deployment Checks" />
  {:else if deployment}
    <!-- Summary -->
    <div
      class="mb-6 rounded-lg border p-4 {deployment.errors > 0
        ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
        : deployment.warnings > 0
          ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
          : 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'}"
      data-testid="deployment-checks-summary"
      data-state={deployment.errors > 0 ? "errors" : deployment.warnings > 0 ? "warnings" : "ok"}
    >
      <p class="font-semibold text-gray-900 dark:text-gray-100">
        {deployment.errors} error{deployment.errors === 1 ? "" : "s"}, {deployment.warnings} warning{deployment.warnings === 1 ? "" : "s"}
      </p>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Instance <code class="font-mono">{deployment.api_instance_id}</code>, checked {new Date(deployment.checked_at).toLocaleString()},
        traffic of the last {deployment.window_minutes} minutes.
      </p>
    </div>

    {#each areas as area (area)}
      <section class="mb-6 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800" data-testid="deployment-area" data-area={area}>
        <h2 class="border-b border-gray-200 p-4 text-lg font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">{area}</h2>
        <ul class="divide-y divide-gray-200 dark:divide-gray-700">
          {#each deployment.checks.filter((c) => c.area === area) as check (check.id)}
            <li class="flex items-start gap-3 p-4" data-testid="deployment-check" data-check={check.id} data-status={check.status}>
              <div class="mt-0.5">
                {#if check.status === "OK"}
                  <CheckCircle2 class="h-5 w-5 text-green-600 dark:text-green-400" />
                {:else if check.status === "WARNING"}
                  <AlertTriangle class="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                {:else if check.status === "ERROR"}
                  <XCircle class="h-5 w-5 text-red-600 dark:text-red-400" />
                {:else if check.status === "MANUAL"}
                  <CircleHelp class="h-5 w-5 text-purple-600 dark:text-purple-400" />
                {:else}
                  <Info class="h-5 w-5 text-gray-500 dark:text-gray-400" />
                {/if}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">{check.title}</span>
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-medium {statusBadge(check.status)}">{check.status}</span>
                  <span class="rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-600 dark:border-gray-600 dark:text-gray-400">
                    {basisLabels[check.basis] ?? check.basis}
                  </span>
                </div>
                <p class="mt-1 text-sm text-gray-700 dark:text-gray-300">{check.message}</p>
                {#if check.evidence.length > 0}
                  <dl class="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2" data-testid="deployment-check-evidence">
                    {#each check.evidence as item (item.name)}
                      <div class="flex gap-2">
                        <dt class="text-gray-500 dark:text-gray-400">{item.name}:</dt>
                        <dd class="break-all font-mono text-gray-800 dark:text-gray-200">{item.value}</dd>
                      </div>
                    {/each}
                  </dl>
                {/if}
                {#if check.props.length > 0}
                  <div class="mt-2 flex flex-wrap items-center gap-1.5" data-testid="deployment-check-props">
                    <span class="text-xs text-gray-500 dark:text-gray-400">props:</span>
                    {#each check.props as prop (prop)}
                      <code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-700 dark:bg-gray-900 dark:text-gray-300">{prop}</code>
                    {/each}
                  </div>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  {/if}
</div>
