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
  import { Wand2, HelpCircle, Globe } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import DomainApiForm from "$lib/components/DomainApiForm.svelte";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";
  import { createDomainApi, type DomainApiFormValues } from "$lib/services/domainApis";

  let { data } = $props();
  const listHref = $derived(`/domain-apis?bank_id=${encodeURIComponent(data.bankId)}`);

  async function handleSubmit(values: DomainApiFormValues) {
    await createDomainApi(data.bankId, values);
    await goto(`${listHref}&saved=${encodeURIComponent(values.base_path)}`);
  }

  const suggestedQuestions: SuggestedQuestion[] = [
    { questionString: "Look at the Dynamic Entities in this space and propose a base path, title and description for a Domain API that publishes them.", pillTitle: "Propose from my entities", icon: Wand2 },
    { questionString: "Fill in a Domain API for an open carbon registry: base path carbon-registry/v1, version 1.0.0, with a short title and description.", pillTitle: "Carbon registry example", icon: Globe },
    { questionString: "Explain what a Domain API publishes and how its version relates to the base path.", pillTitle: "Explain Domain APIs", icon: HelpCircle },
  ];
  const INITIAL_MESSAGE = "Tell me what the API is for and I'll fill in the base path, version, title and description. You review every value before creating it.";
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
  <title>Create Domain API - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6">
    <a href={listHref} class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">← Back to Domain APIs</a>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Create Domain API</h1>
    <div class="mt-2"><ApiExplorerEndpoints endpoints={data.endpoints} /></div>
  </div>

  <ResizableSplit breakpoint="lg">
    {#snippet main()}
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <DomainApiForm
        bankId={data.bankId}
        entityNames={data.entityNames}
        submitLabel="Create Domain API"
        cancelHref={listHref}
        onSubmit={handleSubmit}
      />
    </div>
    {/snippet}

    {#snippet side()}
      <div class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm lg:h-[calc(100vh-80px-3rem)] dark:border-gray-700">
        <OpeyChat {opeyChatOptions} userAuthenticated={!!page.data.userId} {clientTools} {clientContext} />
      </div>
    {/snippet}
  </ResizableSplit>
</div>
