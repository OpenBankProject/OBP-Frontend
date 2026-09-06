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
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import { OpeyChat } from "@obp/shared/components";
  import type { OpeyChatOptions, SuggestedQuestion } from "@obp/shared/components";
  import { Route, Wand2, HelpCircle } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import MethodRoutingForm from "$lib/components/MethodRoutingForm.svelte";
  import {
    fetchMethodNames, fetchConnectorNames, fetchBankIds, fetchMethodRoutings, saveMethodRouting, routingToFormValues,
    type MethodRoutingFormValues,
  } from "$lib/services/methodRoutings";

  let { data } = $props();

  let methodNames = $state<string[]>([]);
  let connectorNames = $state<string[]>([]);
  let bankIds = $state<string[]>([]);
  let listsLoading = $state(true);
  let initial = $state<MethodRoutingFormValues | undefined>(undefined);
  let ready = $state(false);
  let loadError = $state("");

  onMount(async () => {
    const [names, connectors, banks] = await Promise.all([
      fetchMethodNames().catch(() => []),
      fetchConnectorNames().catch(() => []),
      fetchBankIds().catch(() => []),
    ]);
    methodNames = names; connectorNames = connectors; bankIds = banks;
    listsLoading = false;
    try {
      if (data.prefillMethod || data.prefillFromId) {
        const routings = await fetchMethodRoutings(true);
        const source = data.prefillFromId
          ? routings.find((r) => r.method_routing_id === data.prefillFromId)
          : routings.find((r) => r.method_name === data.prefillMethod && !r.method_routing_id) ?? routings.find((r) => r.method_name === data.prefillMethod);
        if (source) initial = routingToFormValues(source, false);
        else if (data.prefillMethod) initial = { method_name: data.prefillMethod, connector_name: "", bank_id_pattern: "", is_bank_id_exact_match: false, parameters: "" };
      }
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    } finally {
      ready = true;
    }
  });

  async function handleSubmit(values: MethodRoutingFormValues) {
    await saveMethodRouting(values);
    await goto("/integration/method-routings?saved=" + encodeURIComponent(values.method_name));
  }

  const clientTools = { set_form_fields: async (toolInput: Record<string, any>) => formBridge.apply(toolInput?.fields ?? {}) };
  const clientContext = () => formBridge.describe();
  const suggestedQuestions: SuggestedQuestion[] = [
    { questionString: "Route getBank and getBanks for every bank to the rest_vMar2019 connector; leave the parameters empty.", pillTitle: "Route to an adapter", icon: Route },
    { questionString: "Fill this form so that transactions for bank gh.29.uk come from the mapped connector, exact match.", pillTitle: "One bank, mapped", icon: Wand2 },
    { questionString: "Explain what a method routing is and when I need bank_id_pattern versus exact match.", pillTitle: "Explain routings", icon: HelpCircle },
  ];
  const opeyChatOptions: Partial<OpeyChatOptions> = {
    baseUrl: env.PUBLIC_OPEY_BASE_URL,
    displayHeader: false,
    currentlyActiveUserName: page.data.username || "Guest",
    suggestedQuestions,
    currentConsentInfo: page.data.opeyConsentInfo || undefined,
    displayConnectionPips: true,
    consentMetricsHref: "/metrics",
    initialAssistantMessage:
      "Tell me which connector method should go to which connector, for which banks, and I'll fill in the routing. You review every value before saving.",
  };
</script>

<svelte:head>
  <title>{data.prefillMethod ? "Override" : "Create"} Method Routing - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6">
    <a href="/integration/method-routings" class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">← Back to Method Routings</a>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">{data.prefillMethod ? `Override ${data.prefillMethod}` : data.prefillFromId ? "Duplicate Method Routing" : "Create Method Routing"}</h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">Send one connector method, for some or all banks, to a connector of your choice.</p>
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {#if loadError}<p class="mb-4 text-sm text-red-700 dark:text-red-300">{loadError}</p>{/if}
      {#if ready}
        <MethodRoutingForm {initial} {methodNames} {connectorNames} {bankIds} {listsLoading} submitLabel="Create routing" cancelHref="/integration/method-routings" onSubmit={handleSubmit} />
      {:else}
        <p class="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      {/if}
    </div>
    <aside class="lg:sticky lg:top-4" data-testid="opey-form-pane">
      <div class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm lg:h-[calc(100vh-8rem)] dark:border-gray-700">
        <OpeyChat {opeyChatOptions} userAuthenticated={!!page.data.userId} {clientTools} {clientContext} />
      </div>
    </aside>
  </div>
</div>
