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
  // The API Product Subscriptions one consumer holds, at every bank where the user may see them.
  // Status changes are made on the product's page, which this list links to.
  import { onMount } from "svelte";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import { extractErrorFromResponse, formatErrorForDisplay, logErrorDetails } from "$lib/utils/errorHandler";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import {
    SUBSCRIPTIONS_API_VERSION,
    SUBSCRIPTION_ROLES,
    STATUS_LABELS,
    type ApiProductSubscription,
    type ApiProductSubscriptionStatus,
  } from "$lib/utils/apiProductSubscriptions";

  let { consumerId }: { consumerId: string } = $props();

  let subscriptions = $state<ApiProductSubscription[]>([]);
  let isLoading = $state(true);
  let loadError = $state("");
  let roleMissing = $state(false);

  onMount(async () => {
    try {
      const response = await trackedFetch(
        `/proxy/obp/${SUBSCRIPTIONS_API_VERSION}/management/consumers/${encodeURIComponent(consumerId)}/api-product-subscriptions`,
      );
      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(response, "Failed to load subscriptions");
        logErrorDetails("Consumer API Product Subscriptions", errorDetails);
        roleMissing = response.status === 403;
        loadError = formatErrorForDisplay(errorDetails);
        return;
      }
      const body = await response.json();
      const loaded: ApiProductSubscription[] = body.api_product_subscriptions ?? [];
      loaded.sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at));
      subscriptions = loaded;
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Failed to load subscriptions";
    } finally {
      isLoading = false;
    }
  });

  function statusLabel(status: string): string {
    return STATUS_LABELS[status as ApiProductSubscriptionStatus] ?? status;
  }

  function formatDate(value: string | null | undefined): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
</script>

<div
  class="mb-8 rounded-lg border p-6 shadow-sm ui-card ui-border"
  data-testid="consumer-api-product-subscriptions"
>
  <h2 class="mb-4 text-lg font-semibold ui-text">API Product Subscriptions</h2>

  {#if isLoading}
    <p class="text-sm ui-muted">Loading subscriptions...</p>
  {:else if roleMissing}
    <MissingRoleAlert roles={[SUBSCRIPTION_ROLES.get]} message={loadError} />
  {:else if loadError}
    <p class="text-sm ui-text-error" data-testid="consumer-api-product-subscriptions-error">{loadError}</p>
  {:else if subscriptions.length === 0}
    <p class="text-sm ui-muted" data-testid="consumer-api-product-subscriptions-empty">No subscriptions.</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y text-sm ui-border">
        <thead class="ui-card">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Product</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Bank</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">Start</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ui-muted">End</th>
          </tr>
        </thead>
        <tbody class="divide-y ui-border">
          {#each subscriptions as subscription (subscription.api_product_subscription_id)}
            <tr
              data-testid="consumer-api-product-subscription-{subscription.api_product_subscription_id}"
              data-status={subscription.status}
            >
              <td class="px-4 py-3">
                <a
                  href="/products/{subscription.bank_id}/{subscription.api_product_code}"
                  class="hover:underline ui-link"
                >{subscription.api_product_code}</a>
              </td>
              <td class="px-4 py-3 font-mono text-xs ui-muted">{subscription.bank_id}</td>
              <td class="px-4 py-3 ui-text">{statusLabel(subscription.status)}</td>
              <td class="whitespace-nowrap px-4 py-3 ui-muted">{formatDate(subscription.start_date)}</td>
              <td class="whitespace-nowrap px-4 py-3 ui-muted">
                {subscription.end_date ? formatDate(subscription.end_date) : "Open-ended"}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
