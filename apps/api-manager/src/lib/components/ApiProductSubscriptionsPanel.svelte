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
  // The subscribers of one API Product: bank staff approve, suspend, reinstate, cancel and delete
  // subscriptions, and enrol a consumer in a product that is closed to self-service.
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import MissingRoleAlert from "$lib/components/MissingRoleAlert.svelte";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";
  import { checkRoles, type UserEntitlement } from "$lib/utils/roleChecker";
  import { extractErrorFromResponse, formatErrorForDisplay, logErrorDetails } from "$lib/utils/errorHandler";
  import { trackedFetch } from "$lib/utils/trackedFetch";
  import { toast } from "$lib/utils/toastService";
  import { explorerResourceDocUrl } from "@obp/shared/explorer";
  import {
    SUBSCRIPTIONS_API_VERSION,
    SUBSCRIPTION_ROLES,
    STATUS_LABELS,
    allowedStatusActions,
    toObpDate,
    type ApiProductSubscription,
    type ApiProductSubscriptionStatus,
    type StatusAction,
  } from "$lib/utils/apiProductSubscriptions";

  let {
    bankId,
    productCode,
    selfSubscribe,
  }: { bankId: string; productCode: string; selfSubscribe: boolean } = $props();

  const subscriptionsPath = $derived(
    `/proxy/obp/${SUBSCRIPTIONS_API_VERSION}/banks/${encodeURIComponent(bankId)}/api-products/${encodeURIComponent(productCode)}/subscriptions`,
  );

  const explorerEndpoints = $derived(
    [
      { operation_id: "OBPv7.0.0-getApiProductSubscriptionsByProduct", verb: "GET", path: "/obp/v7.0.0/banks/BANK_ID/api-products/API_PRODUCT_CODE/subscriptions" },
      { operation_id: "OBPv7.0.0-createApiProductSubscription", verb: "POST", path: "/obp/v7.0.0/banks/BANK_ID/api-products/API_PRODUCT_CODE/subscriptions" },
      { operation_id: "OBPv7.0.0-updateApiProductSubscriptionStatus", verb: "PUT", path: "/obp/v7.0.0/management/api-product-subscriptions/API_PRODUCT_SUBSCRIPTION_ID/status" },
      { operation_id: "OBPv7.0.0-deleteApiProductSubscription", verb: "DELETE", path: "/obp/v7.0.0/management/api-product-subscriptions/API_PRODUCT_SUBSCRIPTION_ID" },
    ].map((endpoint) => ({
      ...endpoint,
      url: explorerResourceDocUrl(endpoint.operation_id, page.data.externalLinks?.API_EXPLORER_URL),
    })),
  );

  let subscriptions = $state<ApiProductSubscription[]>([]);
  let isLoading = $state(true);
  let loadError = $state("");
  /** The Role to show a MissingRoleAlert for, or null. */
  let missingRole = $state<string | null>(null);
  /** The subscription an action is running on, so its buttons are disabled meanwhile. */
  let busySubscriptionId = $state("");

  let enrolConsumerId = $state("");
  let enrolStartDate = $state("");
  let enrolEndDate = $state("");
  let isEnrolling = $state(false);

  /** Whether the user holds the Role at this product's bank, or JIT would grant it. */
  function holdsRole(role: string): boolean {
    const userEntitlements: UserEntitlement[] = page.data.userEntitlements ?? [];
    return checkRoles(userEntitlements, [{ role, bankId }], undefined, "OR", page.data.jitEnabled === true).hasAllRoles;
  }

  /** Shows the MissingRoleAlert instead of making a call that OBP-API would refuse. */
  function requireRole(role: string): boolean {
    if (holdsRole(role)) {
      missingRole = null;
      return true;
    }
    missingRole = role;
    return false;
  }

  async function reportFailure(response: Response, context: string, role: string): Promise<string> {
    const errorDetails = await extractErrorFromResponse(response, context);
    logErrorDetails(context, errorDetails);
    if (response.status === 403) missingRole = role;
    return formatErrorForDisplay(errorDetails);
  }

  async function loadSubscriptions() {
    isLoading = true;
    loadError = "";
    try {
      const response = await trackedFetch(subscriptionsPath);
      if (!response.ok) {
        loadError = await reportFailure(response, "Failed to load subscriptions", SUBSCRIPTION_ROLES.get);
        subscriptions = [];
        return;
      }
      const body = await response.json();
      const loaded: ApiProductSubscription[] = body.api_product_subscriptions ?? [];
      loaded.sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at));
      subscriptions = loaded;
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Failed to load subscriptions";
      subscriptions = [];
    } finally {
      isLoading = false;
    }
  }

  onMount(loadSubscriptions);

  async function changeStatus(subscription: ApiProductSubscription, statusAction: StatusAction) {
    if (!requireRole(SUBSCRIPTION_ROLES.updateStatus)) return;
    if (
      statusAction.confirm &&
      !confirm(`${statusAction.label} the subscription of consumer ${subscription.consumer_id} to ${productCode}?`)
    ) {
      return;
    }
    busySubscriptionId = subscription.api_product_subscription_id;
    try {
      const response = await trackedFetch(
        `/proxy/obp/${SUBSCRIPTIONS_API_VERSION}/management/api-product-subscriptions/${encodeURIComponent(subscription.api_product_subscription_id)}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: statusAction.targetStatus }),
        },
      );
      if (!response.ok) {
        toast.error(
          `Could not change the status`,
          await reportFailure(response, "Failed to change the subscription status", SUBSCRIPTION_ROLES.updateStatus),
        );
        return;
      }
      toast.success("Status changed", `The subscription is now ${statusLabel(statusAction.targetStatus).toLowerCase()}.`);
      await loadSubscriptions();
    } catch (err) {
      toast.error("Could not change the status", err instanceof Error ? err.message : String(err));
    } finally {
      busySubscriptionId = "";
    }
  }

  async function deleteSubscription(subscription: ApiProductSubscription) {
    if (!requireRole(SUBSCRIPTION_ROLES.delete)) return;
    if (!confirm(`Delete the subscription of consumer ${subscription.consumer_id} to ${productCode}?`)) return;
    busySubscriptionId = subscription.api_product_subscription_id;
    try {
      const response = await trackedFetch(
        `/proxy/obp/${SUBSCRIPTIONS_API_VERSION}/management/api-product-subscriptions/${encodeURIComponent(subscription.api_product_subscription_id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        toast.error(
          "Could not delete the subscription",
          await reportFailure(response, "Failed to delete the subscription", SUBSCRIPTION_ROLES.delete),
        );
        return;
      }
      toast.success("Subscription deleted");
      await loadSubscriptions();
    } catch (err) {
      toast.error("Could not delete the subscription", err instanceof Error ? err.message : String(err));
    } finally {
      busySubscriptionId = "";
    }
  }

  async function enrolConsumer(event: SubmitEvent) {
    event.preventDefault();
    if (!requireRole(SUBSCRIPTION_ROLES.create)) return;
    const consumerId = enrolConsumerId.trim();
    if (!consumerId) {
      toast.error("Consumer ID is required");
      return;
    }
    const startDate = toObpDate(enrolStartDate);
    const endDate = toObpDate(enrolEndDate);
    if (startDate && endDate && endDate < startDate) {
      toast.error("The end date must be after the start date");
      return;
    }
    const requestBody: { consumer_id: string; start_date?: string; end_date?: string } = { consumer_id: consumerId };
    if (startDate) requestBody.start_date = startDate;
    if (endDate) requestBody.end_date = endDate;

    isEnrolling = true;
    try {
      const response = await trackedFetch(subscriptionsPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        toast.error(
          "Could not enrol the consumer",
          await reportFailure(response, "Failed to enrol the consumer", SUBSCRIPTION_ROLES.create),
        );
        return;
      }
      const created: ApiProductSubscription = await response.json();
      toast.success("Consumer enrolled", `The subscription is ${statusLabel(created.status).toLowerCase()}.`);
      enrolConsumerId = "";
      enrolStartDate = "";
      enrolEndDate = "";
      await loadSubscriptions();
    } catch (err) {
      toast.error("Could not enrol the consumer", err instanceof Error ? err.message : String(err));
    } finally {
      isEnrolling = false;
    }
  }

  function statusLabel(status: string): string {
    return STATUS_LABELS[status as ApiProductSubscriptionStatus] ?? status;
  }

  const statusStyles: Record<ApiProductSubscriptionStatus, string> = {
    requested: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    past_due: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    suspended: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    cancelled: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  };

  function statusStyle(status: string): string {
    return statusStyles[status as ApiProductSubscriptionStatus] ?? statusStyles.cancelled;
  }

  function formatDate(value: string | null | undefined): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
</script>

<section
  class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
  data-testid="api-product-subscriptions"
>
  <h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
    Subscriptions
    {#if !isLoading && !loadError}
      <span class="ml-2 text-sm font-normal text-gray-500" data-testid="api-product-subscriptions-count">({subscriptions.length})</span>
    {/if}
  </h2>

  {#if missingRole}
    <div class="mb-4">
      <MissingRoleAlert roles={[missingRole]} {bankId} message={`You need the ${missingRole} role at bank ${bankId}.`} />
    </div>
  {/if}

  {#if isLoading}
    <p class="text-sm text-gray-500 dark:text-gray-400" data-testid="api-product-subscriptions-loading">Loading subscriptions...</p>
  {:else if loadError}
    <p class="text-sm text-red-700 dark:text-red-400" data-testid="api-product-subscriptions-error">{loadError}</p>
  {:else if subscriptions.length === 0}
    <p class="text-sm text-gray-500 dark:text-gray-400" data-testid="api-product-subscriptions-empty">No subscriptions.</p>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
        <thead class="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Consumer ID</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Status</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Start</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">End</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Created by user ID</th>
            <th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Attributes</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          {#each subscriptions as subscription (subscription.api_product_subscription_id)}
            <tr
              class="align-top"
              data-testid="api-product-subscription-{subscription.api_product_subscription_id}"
              data-status={subscription.status}
            >
              <td class="px-4 py-3">
                <a
                  href="/consumers/{subscription.consumer_id}/edit"
                  class="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                  data-testid="api-product-subscription-consumer-link"
                >{subscription.consumer_id}</a>
                <div class="mt-1 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                  Subscription ID: {subscription.api_product_subscription_id}
                </div>
              </td>
              <td class="px-4 py-3">
                <span class="whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium {statusStyle(subscription.status)}">
                  {statusLabel(subscription.status)}
                </span>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(subscription.start_date)}</td>
              <td class="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">
                {subscription.end_date ? formatDate(subscription.end_date) : "Open-ended"}
              </td>
              <td class="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{subscription.created_by_user_id}</td>
              <td class="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                {#if subscription.attributes && subscription.attributes.length > 0}
                  <ul class="space-y-0.5">
                    {#each subscription.attributes as subscriptionAttribute (subscriptionAttribute.api_product_subscription_attribute_id)}
                      <li><span class="font-medium">{subscriptionAttribute.name}</span>: <span class="font-mono">{subscriptionAttribute.value}</span></li>
                    {/each}
                  </ul>
                {:else}
                  -
                {/if}
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap justify-end gap-2">
                  {#each allowedStatusActions(subscription.status) as statusAction (statusAction.label)}
                    <button
                      type="button"
                      onclick={() => changeStatus(subscription, statusAction)}
                      disabled={busySubscriptionId === subscription.api_product_subscription_id}
                      class="rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50 {statusAction.confirm
                        ? 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20'
                        : 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/20'}"
                      data-testid="api-product-subscription-action-{statusAction.label.toLowerCase()}"
                    >
                      {statusAction.label}
                    </button>
                  {/each}
                  <button
                    type="button"
                    onclick={() => deleteSubscription(subscription)}
                    disabled={busySubscriptionId === subscription.api_product_subscription_id}
                    class="rounded-md border border-red-300 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                    data-testid="api-product-subscription-action-delete"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if !selfSubscribe}
    <form
      class="mt-6 border-t border-gray-200 pt-4 dark:border-gray-700"
      onsubmit={enrolConsumer}
      data-testid="api-product-subscription-enrol-form"
    >
      <h3 class="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">Enrol a consumer</h3>
      <div class="grid gap-4 md:grid-cols-3">
        <label class="block text-sm">
          <span class="font-medium text-gray-700 dark:text-gray-300">Consumer ID</span>
          <input
            type="text"
            name="consumer_id"
            bind:value={enrolConsumerId}
            required
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            data-testid="api-product-subscription-enrol-consumer-id"
          />
        </label>
        <label class="block text-sm">
          <span class="font-medium text-gray-700 dark:text-gray-300">Start date (optional)</span>
          <input
            type="date"
            name="start_date"
            bind:value={enrolStartDate}
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            data-testid="api-product-subscription-enrol-start-date"
          />
        </label>
        <label class="block text-sm">
          <span class="font-medium text-gray-700 dark:text-gray-300">End date (optional)</span>
          <input
            type="date"
            name="end_date"
            bind:value={enrolEndDate}
            min={enrolStartDate || undefined}
            class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            data-testid="api-product-subscription-enrol-end-date"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={isEnrolling}
        class="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
        data-testid="api-product-subscription-enrol-submit"
      >
        {isEnrolling ? "Enrolling..." : "Enrol"}
      </button>
    </form>
  {/if}

  <div class="mt-4">
    <ApiExplorerEndpoints endpoints={explorerEndpoints} testid="api-product-subscriptions-endpoints" />
  </div>
</section>
