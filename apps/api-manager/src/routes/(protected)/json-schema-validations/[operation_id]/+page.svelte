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
  import { Wand2, HelpCircle, Trash2, ExternalLink } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import JsonSchemaValidationForm from "$lib/components/JsonSchemaValidationForm.svelte";
  import { saveJsonSchemaValidation, deleteJsonSchemaValidation, schemaToText, type JsonSchemaValidationFormValues } from "$lib/services/jsonSchemaValidations";

  let { data } = $props();
  const operationId = $derived(data.validation.operation_id as string);
  let deleting = $state(false);
  let actionError = $state<string | null>(null);

  async function handleSubmit(values: JsonSchemaValidationFormValues) {
    await saveJsonSchemaValidation(values, true);
    await goto("/json-schema-validations?saved=" + encodeURIComponent(values.operation_id));
  }

  async function handleDelete() {
    if (!confirm(`Delete the JSON Schema Validation for ${operationId}?`)) return;
    deleting = true;
    actionError = null;
    try {
      await deleteJsonSchemaValidation(operationId);
      await goto("/json-schema-validations");
    } catch (e) {
      actionError = e instanceof Error ? e.message : String(e);
    } finally {
      deleting = false;
    }
  }

  const suggestedQuestions: SuggestedQuestion[] = [
    { questionString: "Make this schema stricter: set additionalProperties to false and add sensible minLength/maxLength to every string.", pillTitle: "Make it stricter", icon: Wand2 },
    { questionString: "Explain in plain words which requests this schema rejects.", pillTitle: "Explain this schema", icon: HelpCircle },
  ];
  const INITIAL_MESSAGE = "I can change this schema for you or explain what it rejects. Tell me what should be different.";
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
  <title>Edit JSON Schema Validation - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
    <div>
      <a href="/json-schema-validations" class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">← Back to JSON Schema Validations</a>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Edit JSON Schema Validation</h1>
      <p class="mt-1 font-mono text-sm text-gray-600 dark:text-gray-400">{operationId}</p>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {#if data.endpoint}
          <span class="font-mono text-xs">{data.endpoint.request_verb} {data.endpoint.request_url}</span> — {data.endpoint.summary}
        {:else}
          Not found in this instance's resource docs.
        {/if}
        <a href={data.explorerUrl} target="_blank" rel="noopener noreferrer" class="ml-2 inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400" data-testid="api-explorer-link">
          API Explorer <ExternalLink size={12} />
        </a>
      </p>
    </div>
    <button type="button" onclick={handleDelete} disabled={deleting} data-testid="delete-btn" class="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20">
      <Trash2 size={14} /> {deleting ? "Deleting…" : "Delete"}
    </button>
  </div>

  {#if actionError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="action-error">{actionError}</div>
  {/if}

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {#key operationId}
        <JsonSchemaValidationForm
          initial={{ operation_id: operationId, json_schema: schemaToText(data.validation.json_schema) }}
          operationChoices={data.operationChoices}
          lockOperationId={true}
          submitLabel="Save changes"
          cancelHref="/json-schema-validations"
          onSubmit={handleSubmit}
        />
      {/key}
    </div>
    <aside class="lg:sticky lg:top-8" data-testid="opey-form-pane">
      <div class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm lg:h-[calc(100vh-80px-3rem)] dark:border-gray-700">
        <OpeyChat {opeyChatOptions} userAuthenticated={!!page.data.userId} {clientTools} {clientContext} />
      </div>
    </aside>
  </div>
</div>
