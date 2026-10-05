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
  import { Wand2, HelpCircle, Trash2, ExternalLink } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import DomainApiForm from "$lib/components/DomainApiForm.svelte";
  import ApiExplorerEndpoints from "$lib/components/ApiExplorerEndpoints.svelte";
  import { updateDomainApi, deleteDomainApi, type DomainApiFormValues } from "$lib/services/domainApis";

  let { data } = $props();
  const d = $derived(data.domainApi);
  const listHref = $derived(`/domain-apis?bank_id=${encodeURIComponent(d.bank_id)}`);
  let deleting = $state(false);
  let actionError = $state<string | null>(null);

  async function handleSubmit(values: DomainApiFormValues) {
    await updateDomainApi(d.bank_id, d.domain_api_id, values);
    await goto(`${listHref}&saved=${encodeURIComponent(values.base_path)}`);
  }

  async function handleDelete() {
    if (!confirm(`Delete the Domain API /${d.base_path}?`)) return;
    deleting = true;
    actionError = null;
    try {
      await deleteDomainApi(d.bank_id, d.domain_api_id);
      await goto(listHref);
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      deleting = false;
    }
  }

  const suggestedQuestions: SuggestedQuestion[] = [
    { questionString: "Rewrite the description so it says what the API offers, listing the Dynamic Entities in this space.", pillTitle: "Improve description", icon: Wand2 },
    { questionString: "I've added new optional fields. Which part of the version should I bump, and to what?", pillTitle: "Which version bump?", icon: HelpCircle },
  ];
  const INITIAL_MESSAGE = "I can change the title, description or version for you. A new base path moves every published URL, so for a breaking change create a new Domain API with the next vN instead.";
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
  <title>Edit Domain API - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <a href={listHref} class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">← Back to Domain APIs</a>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">{d.title}</h1>
      <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="domain-api-details">
        <dt class="text-gray-500 dark:text-gray-400">URL</dt>
        <dd class="font-mono text-xs"><a href={d.url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400">{d.url} <ExternalLink size={12} /></a></dd>
        <dt class="text-gray-500 dark:text-gray-400">OpenAPI</dt>
        <dd class="font-mono text-xs"><a href={d.openapi_url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400">{d.openapi_url} <ExternalLink size={12} /></a></dd>
        <dt class="text-gray-500 dark:text-gray-400">Space</dt>
        <dd class="font-mono text-xs text-gray-900 dark:text-gray-100">{d.bank_id}</dd>
        <dt class="text-gray-500 dark:text-gray-400">domain_api_id</dt>
        <dd class="font-mono text-xs text-gray-900 dark:text-gray-100">{d.domain_api_id}</dd>
        <dt class="text-gray-500 dark:text-gray-400">Created</dt>
        <dd class="text-xs text-gray-900 dark:text-gray-100">{d.created_at} by <a href="/users/{encodeURIComponent(d.created_by_user_id)}" class="font-mono text-blue-600 hover:underline dark:text-blue-400">{d.created_by_user_id}</a></dd>
        <dt class="text-gray-500 dark:text-gray-400">Updated</dt>
        <dd class="text-xs text-gray-900 dark:text-gray-100">{d.updated_at}</dd>
      </dl>
      <div class="mt-3"><ApiExplorerEndpoints endpoints={data.endpoints} /></div>
    </div>
    <button type="button" onclick={handleDelete} disabled={deleting} data-testid="delete-btn" class="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20">
      <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete"}
    </button>
  </div>

  {#if actionError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="action-error">{actionError}</div>
  {/if}

  <ResizableSplit breakpoint="lg">
    {#snippet main()}
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {#key d.domain_api_id}
        <DomainApiForm
          initial={{ base_path: d.base_path, version: d.version, title: d.title, description: d.description }}
          bankId={d.bank_id}
          entityNames={data.entityNames}
          submitLabel="Save changes"
          cancelHref={listHref}
          onSubmit={handleSubmit}
        />
      {/key}
    </div>
    {/snippet}

    {#snippet side()}
      <div class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm lg:h-[calc(100vh-80px-3rem)] dark:border-gray-700">
        <OpeyChat {opeyChatOptions} userAuthenticated={!!page.data.userId} {clientTools} {clientContext} />
      </div>
    {/snippet}
  </ResizableSplit>
</div>
