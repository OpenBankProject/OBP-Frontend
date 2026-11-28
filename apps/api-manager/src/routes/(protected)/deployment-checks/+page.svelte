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
    if (status === "OK") return "ui-tone-success";
    if (status === "WARNING") return "ui-tone-warning";
    if (status === "ERROR") return "ui-tone-error";
    if (status === "MANUAL") return "ui-tone-accent";
    return "ui-panel ui-muted";
  }
</script>

<svelte:head>
  <title>Deployment Checks - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8" data-testid="deployment-checks-page">
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="text-3xl font-bold ui-text">Deployment Checks</h1>
      <p class="mt-1 max-w-3xl ui-muted">
        Whether this OBP-API instance, and the proxy and applications in front of it, are set up so that per-IP
        limits, IP penalties and the busiest-callers view see real client addresses. Worked out from its props
        and its traffic of the last few minutes.
      </p>
    </div>
    {#if data.hasRole}
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50 ui-card ui-hover ui-muted ui-border"
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
        ? 'ui-tone-error'
        : deployment.warnings > 0
          ? 'ui-tone-warning'
          : 'ui-tone-success'}"
      data-testid="deployment-checks-summary"
      data-state={deployment.errors > 0 ? "errors" : deployment.warnings > 0 ? "warnings" : "ok"}
    >
      <p class="font-semibold ui-text">
        {deployment.errors} error{deployment.errors === 1 ? "" : "s"}, {deployment.warnings} warning{deployment.warnings === 1 ? "" : "s"}
      </p>
      <p class="mt-1 text-sm ui-muted">
        Instance <code class="font-mono">{deployment.api_instance_id}</code>, checked {new Date(deployment.checked_at).toLocaleString(undefined, { hourCycle: "h23" })},
        traffic of the last {deployment.window_minutes} minutes.
      </p>
    </div>

    {#each areas as area (area)}
      <section class="mb-6 rounded-lg border shadow-sm ui-card ui-border" data-testid="deployment-area" data-area={area}>
        <h2 class="border-b p-4 text-lg font-semibold ui-text ui-border">{area}</h2>
        <ul class="divide-y ui-border">
          {#each deployment.checks.filter((c) => c.area === area) as check (check.id)}
            <li class="flex items-start gap-3 p-4" data-testid="deployment-check" data-check={check.id} data-status={check.status}>
              <div class="mt-0.5">
                {#if check.status === "OK"}
                  <CheckCircle2 class="h-5 w-5 ui-text-success" />
                {:else if check.status === "WARNING"}
                  <AlertTriangle class="h-5 w-5 ui-text-warning" />
                {:else if check.status === "ERROR"}
                  <XCircle class="h-5 w-5 ui-text-error" />
                {:else if check.status === "MANUAL"}
                  <CircleHelp class="h-5 w-5 ui-text-brand" />
                {:else}
                  <Info class="h-5 w-5 ui-muted" />
                {/if}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-sm font-semibold ui-text">{check.title}</span>
                  <span class="rounded-full px-2.5 py-0.5 text-xs font-medium {statusBadge(check.status)}">{check.status}</span>
                  <span class="rounded-full border px-2 py-0.5 text-xs ui-muted ui-border">
                    {basisLabels[check.basis] ?? check.basis}
                  </span>
                </div>
                <p class="mt-1 text-sm ui-muted">{check.message}</p>
                {#if check.evidence.length > 0}
                  <dl class="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2" data-testid="deployment-check-evidence">
                    {#each check.evidence as item (item.name)}
                      <div class="flex gap-2">
                        <dt class="ui-muted">{item.name}:</dt>
                        <dd class="break-all font-mono ui-text">{item.value}</dd>
                      </div>
                    {/each}
                  </dl>
                {/if}
                {#if check.props.length > 0}
                  <div class="mt-2 flex flex-wrap items-center gap-1.5" data-testid="deployment-check-props">
                    <span class="text-xs ui-muted">props:</span>
                    {#each check.props as prop (prop)}
                      <code class="rounded px-1.5 py-0.5 text-xs font-mono ui-panel ui-muted">{prop}</code>
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
