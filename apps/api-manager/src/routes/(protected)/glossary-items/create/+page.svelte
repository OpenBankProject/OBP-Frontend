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
  import { OpeyChat } from "@obp/shared/components";
  import type { OpeyChatOptions, SuggestedQuestion } from "@obp/shared/components";
  import { Wand2, HelpCircle, BookOpen } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import GlossaryItemForm from "$lib/components/GlossaryItemForm.svelte";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";
  import { saveGlossaryItem, type GlossaryItemFormValues } from "$lib/services/glossaryItems";

  let { data } = $props();

  async function handleSubmit(values: GlossaryItemFormValues) {
    await saveGlossaryItem(values, false);
    await goto("/glossary-items?saved=" + encodeURIComponent(values.title));
  }

  const suggestedQuestions: SuggestedQuestion[] = [
    { questionString: "Write a glossary entry for a term used at this bank that developers keep asking about, in the same style as the OBP glossary.", pillTitle: "Draft an entry", icon: BookOpen },
    { questionString: "Look up an existing glossary entry and rewrite it to be clearer and shorter, keeping every fact.", pillTitle: "Rewrite an entry", icon: Wand2 },
    { questionString: "Explain what a Dynamic Glossary Item is and what happens when its title matches a static one.", pillTitle: "Explain the feature", icon: HelpCircle },
  ];
  const INITIAL_MESSAGE = "Tell me the term and what it means here, and I'll fill in the title and a markdown description. You review every word before creating it.";
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
  <title>Create Dynamic Glossary Item - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6">
    <a href="/glossary-items" class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">← Back to Dynamic Glossary Items</a>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Create Dynamic Glossary Item</h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">Add a term to the Glossary, or correct one that ships with the API, without redeploying.</p>
    <div class="mt-3"><ApiExplorerEndpoints endpoints={data.endpoints} label="Posts to" /></div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {#if data.titlesError}
        <p class="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100" data-testid="titles-error">
          The existing Dynamic Glossary Items could not be loaded: {data.titlesError}. You can still create one; OBP returns 409 if the title is already taken.
        </p>
      {/if}
      <GlossaryItemForm
        initial={{ title: data.prefillTitle, description: "", overrides_static_item: false }}
        staticTitles={data.staticTitles}
        existingTitles={data.existingTitles}
        submitLabel="Create glossary item"
        cancelHref="/glossary-items"
        onSubmit={handleSubmit}
      />
    </div>
    <aside class="lg:sticky lg:top-8" data-testid="opey-form-pane">
      <div class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm lg:h-[calc(100vh-80px-3rem)] dark:border-gray-700">
        <OpeyChat {opeyChatOptions} userAuthenticated={!!page.data.userId} {clientTools} {clientContext} />
      </div>
    </aside>
  </div>
</div>
