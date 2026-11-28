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
  import { isSafeLinkUrl, redirectUrlEntries, timeAgo } from "@obp/shared/utils";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";
  import { toast } from "$lib/utils/toastService";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";

  let { data } = $props();
  // $derived, not const: /consumers is re-loaded in place when the created-date window
  // params change (dashboard drill-down / Clear filter), and a const would go stale.
  const consumers = $derived(data.consumers);
  const errorMessage = $derived(data.error);

  let searchQuery = $state("");

  const lastCalls = $derived(data.consumerLastCalls);
  const platformApps = $derived(data.platformApps);

  // What the list says about a Consumer being a Platform App, or null when it is not one.
  function platformAppText(consumerId: string): string | null {
    if (!data.canGetPlatformApps) return "Platform App status unknown (Entitlement required)";
    if (!platformApps) return "Platform App status unknown";
    const app = platformApps[consumerId];
    return app ? `Platform App: ${app.label}` : null;
  }

  function formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
      });
    } catch {
      return "Unknown date";
    }
  }

  function lastCallText(consumerId: string): string | null {
    if (!lastCalls) return null;
    if (lastCalls.lastCalls[consumerId]) return `Last call: ${timeAgo(lastCalls.lastCalls[consumerId])}`;
    if (lastCalls.trackedSince) return `No call since ${formatDate(lastCalls.trackedSince)}`;
    return "Last call: —";
  }

  // The card's text, one item per line, without the buttons.
  function consumerText(consumer: any): string {
    const lines = [consumer.app_name];
    if (consumer.description) lines.push(consumer.description);
    lines.push(`Status: ${consumer.enabled ? "Enabled" : "Disabled"}`);
    lines.push(`App type: ${consumer.app_type}`);
    const platformApp = platformAppText(consumer.consumer_id);
    if (platformApp) lines.push(platformApp);
    const lastCall = lastCallText(consumer.consumer_id);
    if (lastCall) lines.push(lastCall);
    lines.push(`Created: ${formatDate(consumer.created)}`);
    lines.push(`Consumer ID: ${consumer.consumer_id}`);
    if (consumer.company) lines.push(`Company: ${consumer.company}`);
    lines.push(`Developer Email: ${consumer.developer_email}`);
    lines.push(`Redirect URL: ${consumer.redirect_url ? redirectUrlEntries(consumer.redirect_url).join(" ") : "Not specified"}`);
    return lines.join("\n");
  }

  async function copyConsumer(consumer: any) {
    try {
      await navigator.clipboard.writeText(consumerText(consumer));
      toast.info(`${consumer.app_name} copied to clipboard`);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error(`Failed to copy ${consumer.app_name}`);
    }
  }

  let filteredConsumers = $derived(
    !consumers || !searchQuery.trim()
      ? consumers
      : consumers.filter((consumer: any) => {
          const query = searchQuery.toLowerCase();
          return (
            consumer.app_name?.toLowerCase().includes(query) ||
            consumer.consumer_id?.toLowerCase().includes(query) ||
            consumer.description?.toLowerCase().includes(query) ||
            consumer.company?.toLowerCase().includes(query) ||
            consumer.developer_email?.toLowerCase().includes(query) ||
            consumer.app_type?.toLowerCase().includes(query)
          );
        }),
  );

  $effect(() => {
    console.log("Consumers:", consumers?.length || 0);
    console.log("Search query:", searchQuery);
    console.log("Filtered consumers:", filteredConsumers?.length || 0);
  });
</script>

  <div class="flex items-center justify-between mb-4">
    <h1 class="text-2xl font-bold ui-text">
      API Consumers
    </h1>
    <div class="flex items-center gap-4">
      {#if consumers && consumers.length > 0}
        <span class="text-sm ui-muted">
          Total: {consumers.length}
        </span>
      {/if}
      {#if data.portalUrl}
        <a
          href="{data.portalUrl}/consumers/register"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium preset-filled-primary-500"
          data-testid="consumers-register-in-portal"
        >
          Register Consumer in Portal
        </a>
      {/if}
    </div>
  </div>

  {#if data.createdWindow}
    <div
      class="mb-4 rounded-lg border p-3 text-sm ui-tone-info"
      data-testid="consumers-created-window"
    >
      Showing consumers created between {formatDate(data.createdWindow.from)} and {formatDate(
        data.createdWindow.to,
      )} — {consumers ? consumers.length : 0} found.
      <a href="/consumers" class="ml-1 underline">Clear filter</a>
    </div>
  {/if}

  <!-- Error Message -->
  {#if errorMessage}
    <div
      class="mb-4 rounded-lg border p-4 ui-tone-error"
    >
      <div class="flex items-start">
        <svg
          class="mr-3 h-5 w-5 flex-shrink-0 ui-text-error"
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
            Error Loading Consumers
          </h3>
          <p class="mt-1 text-sm ui-text-error">
            {errorMessage}
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Search Box -->
  {#if !errorMessage && consumers && consumers.length > 0}
    <div class="mb-3">
      <div class="relative">
        <div
          class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
        >
          <svg
            class="h-4 w-4 ui-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search consumers by name, ID, company, email, or type..."
          class="block w-full rounded-lg border py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-1 ui-card ui-text ui-border"
        />
        {#if searchQuery}
          <button
            onclick={() => (searchQuery = "")}
            class="absolute inset-y-0 right-0 flex items-center pr-3 ui-muted"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        {/if}
      </div>
      {#if searchQuery && filteredConsumers}
        <p class="mt-1 text-xs ui-muted">
          Showing {filteredConsumers.length} of {consumers.length} consumers
        </p>
      {/if}
    </div>
  {/if}

  {#if !errorMessage && consumers && consumers.length > 0 && !data.canGetPlatformApps}
    <div class="mb-3">
      <MissingRoleAlert roles={[data.platformAppsRole]} message="You need this role to see which Consumers are Platform Apps" />
    </div>
  {/if}

  {#if !errorMessage && filteredConsumers && filteredConsumers.length > 0}
    <div class="space-y-2">
      {#each filteredConsumers as consumer (consumer.consumer_id)}
        <div
          class="rounded-lg border p-3 shadow-sm ui-card ui-border"
        >
          <!-- Name, last call, actions and status on one line -->
          <div class="flex items-center gap-3">
            <h2 class="flex-1 min-w-0 text-base font-semibold truncate">
              <a
                data-testid="consumer-name-link"
                href="/consumers/{consumer.consumer_id}/edit"
                class="hover:underline ui-link ui-text"
              >
                {consumer.app_name}
              </a>
            </h2>
            {#if lastCalls}
              <span
                data-testid="consumer-last-call-{consumer.consumer_id}"
                class="flex-shrink-0 whitespace-nowrap text-xs ui-muted"
              >
                {#if lastCalls.lastCalls[consumer.consumer_id]}
                  Last call: {timeAgo(lastCalls.lastCalls[consumer.consumer_id])}
                {:else if lastCalls.trackedSince}
                  No call since {formatDate(lastCalls.trackedSince)}
                {:else}
                  Last call: &mdash;
                {/if}
              </span>
            {/if}
            <div class="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                data-testid="consumer-copy-{consumer.consumer_id}"
                aria-label="Copy the details of {consumer.app_name}"
                title="Copy details"
                onclick={() => copyConsumer(consumer)}
                class="inline-flex items-center rounded p-1 focus:outline-none focus:ring-2 focus:ring-offset-1 ui-hover ui-muted"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <a
                data-testid="consumer-view-metrics-link-{consumer.consumer_id}"
                href="/metrics?consumer_id={consumer.consumer_id}"
                class="inline-flex items-center rounded border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 ui-text-warning ui-card ui-hover ui-border"
              >
                <svg
                  class="mr-1 h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                Metrics
              </a>
              <a
                href="/consumers/{consumer.consumer_id}/rate-limits"
                class="inline-flex items-center rounded border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 ui-card ui-hover ui-muted ui-border"
              >
                <svg
                  class="mr-1 h-3 w-3"
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
                Rate Limits
              </a>
              <a
                href="/consumers/{consumer.consumer_id}/edit"
                class="inline-flex items-center rounded border px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-offset-1 ui-tone-info"
              >
                <svg
                  class="mr-1 h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Details
              </a>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium {consumer.enabled
                  ? 'ui-tone-success'
                  : 'ui-tone-error'}"
              >
                {consumer.enabled ? "Enabled" : "Disabled"}
              </span>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium ui-tone-info"
              >
                {consumer.app_type}
              </span>
              {#if !data.canGetPlatformApps || !platformApps}
                <span
                  data-testid="consumer-platform-app-unknown-{consumer.consumer_id}"
                  title={data.canGetPlatformApps ? `Could not read the Platform Apps: ${data.platformAppsError}` : `Needs the Role ${data.platformAppsRole}`}
                  class="rounded-full px-2 py-0.5 text-xs font-medium ui-panel ui-muted"
                >
                  {platformAppText(consumer.consumer_id)}
                </span>
              {:else if platformApps[consumer.consumer_id]}
                <a
                  data-testid="consumer-platform-app-{consumer.consumer_id}"
                  href="/consumers/platform-apps"
                  title={platformApps[consumer.consumer_id].label}
                  class="rounded-full px-2 py-0.5 text-xs font-medium ui-tone-accent"
                >
                  Platform App
                </a>
              {/if}
            </div>
          </div>

          {#if consumer.description}
            <p class="mt-1 text-xs ui-muted">
              {consumer.description}
            </p>
          {/if}

          <!-- Details on as few lines as the width allows -->
          <div class="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
            <span>
              <span class="font-medium ui-muted">Created:</span>
              <span class="ui-text">{formatDate(consumer.created)}</span>
            </span>
            <span>
              <span class="font-medium ui-muted">Consumer ID:</span>
              <span class="font-mono ui-text">{consumer.consumer_id}</span>
            </span>
            {#if consumer.company}
              <span>
                <span class="font-medium ui-muted">Company:</span>
                <span class="ui-text">{consumer.company}</span>
              </span>
            {/if}
            <span>
              <span class="font-medium ui-muted">Developer Email:</span>
              <span class="ui-text">{consumer.developer_email}</span>
            </span>
            <span>
              <span class="font-medium ui-muted">Redirect URL:</span>
              {#if consumer.redirect_url}
                <!-- Each entry on its own; only an http or https entry becomes a link, so a stored
                     javascript: value is shown as text and can never run when clicked. -->
                {#each redirectUrlEntries(consumer.redirect_url) as entry}
                  {#if isSafeLinkUrl(entry)}
                    <a
                      data-testid="consumer-redirect-url-link"
                      href={entry}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="ml-1 hover:underline break-all ui-link"
                    >{entry}</a>
                  {:else}
                    <span data-testid="consumer-redirect-url-text" class="ml-1 break-all ui-text">{entry}</span>
                  {/if}
                {/each}
              {:else}
                <span class="ui-text">Not specified</span>
              {/if}
            </span>
          </div>
        </div>
      {/each}
    </div>
  {:else if !errorMessage}
    <div class="rounded-lg p-8 text-center ui-panel">
      <svg
        class="mx-auto mb-4 h-16 w-16 ui-muted"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
        />
      </svg>
      <p class="mb-2 text-lg font-medium ui-muted">
        No API consumers found
      </p>
      <p class="mb-4 ui-muted">
        You haven't registered any API consumers yet.
      </p>
      <a
        href="/consumers/register"
        class="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 preset-filled-primary-500"
      >
        Register Your First Consumer
      </a>
    </div>
  {/if}

  <div class="mt-6">
    <ApiExplorerEndpoints endpoints={data.endpoints} />
  </div>
