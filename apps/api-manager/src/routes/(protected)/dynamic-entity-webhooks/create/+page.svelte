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
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import { OpeyChat, ResizableSplit } from "@obp/shared/components";
  import type { OpeyChatOptions, SuggestedQuestion } from "@obp/shared/components";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import { Wand2, HelpCircle, Filter, CircleHelp } from "@lucide/svelte";
  import DynamicEntityWebhookForm from "$lib/components/DynamicEntityWebhookForm.svelte";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";
  import SpaceRoleAlerts from "$lib/components/SpaceRoleAlerts.svelte";
  import { createWebhook, webhookPageHref, WEBHOOK_ROLES, type WebhookFormValues } from "$lib/services/dynamicEntityWebhooks";

  let { data } = $props();
  const listHref = $derived(`/dynamic-entity-webhooks?bank_id=${encodeURIComponent(data.bankId)}`);

  let chosenId = $state(data.dynamicEntityId || data.entities[0]?.dynamic_entity_id || "");
  const entity = $derived(data.entities.find((e) => e.dynamic_entity_id === chosenId));

  async function handleSubmit(values: WebhookFormValues) {
    if (!entity) throw new Error("Choose a Dynamic Entity.");
    const created = await createWebhook(entity.bank_id, entity.dynamic_entity_id, values);
    // The new webhook's page, where a test request can be sent straight away.
    await goto(`${webhookPageHref(created)}?created=1`);
  }

  const suggestedQuestions: SuggestedQuestion[] = [
    { questionString: "Fill in a webhook for this entity that tells my receiver about every create, update and delete. Ask me for the receiver's URL.", pillTitle: "Every change", icon: Wand2 },
    { questionString: "Fill in a webhook that only sends an update when a status-like field of this entity changes to a final value. Look at the entity's fields and propose the condition.", pillTitle: "Only on a status change", icon: Filter },
    { questionString: "Explain what a webhook request contains, how it is signed and how retries work.", pillTitle: "Explain webhooks", icon: HelpCircle },
  ];
  const INITIAL_MESSAGE = "Tell me where to send the requests and which changes matter, and I'll fill in the URL, events and field conditions. You review every value before creating it.";

  const clientTools = { set_form_fields: async (toolInput: Record<string, any>) => formBridge.apply(toolInput?.fields ?? {}) };
  const clientContext = () => formBridge.describe();
  const opeyChatOptions: Partial<OpeyChatOptions> = {
    baseUrl: env.PUBLIC_OPEY_BASE_URL,
    displayHeader: false,
    currentlyActiveUserName: page.data.username || "Guest",
    suggestedQuestions,
    currentConsentInfo: page.data.opeyConsentInfo || undefined,
    displayConnectionPips: true,
    consentMetricsHref: "/metrics",
    initialAssistantMessage: INITIAL_MESSAGE,
  };
</script>

<svelte:head>
  <title>Create Dynamic Entity Webhook - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6">
    <a href={listHref} class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">← Back to Dynamic Entity Webhooks</a>
    <div class="flex items-center gap-3">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Create Dynamic Entity Webhook</h1>
      <a href="/dynamic-entity-webhooks/help" aria-label="Dynamic Entity Webhooks help" data-testid="webhooks-help-link" class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
          <CircleHelp size={16} />
        </a>
    </div>
    <div class="mt-2"><ApiExplorerEndpoints endpoints={data.endpoints} /></div>
  </div>

  <SpaceRoleAlerts bankId={data.bankId} roles={[{ role: WEBHOOK_ROLES.create, purpose: "to create a webhook" }]} />

  {#if data.loadError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="load-error">{data.loadError}</div>
  {:else if data.entities.length === 0}
    <div class="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400" data-testid="no-entities">
      There are no Dynamic Entities in {data.bankId}. A webhook belongs to one Dynamic Entity, so create one first.
    </div>
  {:else}
    <div class="mb-6">
      <label for="entity" class="block text-sm font-medium text-gray-700 dark:text-gray-300">Dynamic Entity in {data.bankId} <span class="text-red-500">*</span></label>
      <select id="entity" bind:value={chosenId} class="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100" data-testid="entity-select">
        {#each data.entities as e (e.dynamic_entity_id)}
          <option value={e.dynamic_entity_id}>{e.entity_name}</option>
        {/each}
      </select>
    </div>

    <ResizableSplit breakpoint="lg">
      {#snippet main()}
      {#if entity}
        <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {#key entity.dynamic_entity_id}
            <DynamicEntityWebhookForm {entity} submitLabel="Create webhook" cancelHref={listHref} onSubmit={handleSubmit} />
          {/key}
        </div>
      {/if}
      {/snippet}

    {#snippet side()}
      <div class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm lg:h-[calc(100vh-80px-3rem)] dark:border-gray-700">
        <OpeyChat {opeyChatOptions} userAuthenticated={!!page.data.userId} {clientTools} {clientContext} />
      </div>
    {/snippet}
  </ResizableSplit>
  {/if}
</div>
