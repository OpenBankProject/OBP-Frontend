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
  import { Wand2, HelpCircle, Braces } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import JsonSchemaValidationForm from "$lib/components/JsonSchemaValidationForm.svelte";
  import { saveJsonSchemaValidation, type JsonSchemaValidationFormValues } from "$lib/services/jsonSchemaValidations";

  let { data } = $props();

  async function handleSubmit(values: JsonSchemaValidationFormValues) {
    await saveJsonSchemaValidation(values, false);
    await goto("/json-schema-validations?saved=" + encodeURIComponent(values.operation_id));
  }

  const suggestedQuestions: SuggestedQuestion[] = [
    { questionString: "Write a JSON Schema for the create customer endpoint that requires legal_name and a mobile_phone_number in E.164 format.", pillTitle: "Schema for create customer", icon: Braces },
    { questionString: "Look at the example request body of the chosen endpoint and draft a strict schema from it: every field required, additionalProperties false.", pillTitle: "Strict schema from the example", icon: Wand2 },
    { questionString: "Explain what JSON Schema Validation does in OBP and when a request is rejected.", pillTitle: "Explain validations", icon: HelpCircle },
  ];
  const INITIAL_MESSAGE = "Tell me which endpoint to protect and what its request body must look like, and I'll fill in the operation id and a draft-07 JSON Schema. You review every value before creating it.";
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
  <title>Create JSON Schema Validation - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6">
    <a href="/json-schema-validations" class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">← Back to JSON Schema Validations</a>
    <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Create JSON Schema Validation</h1>
    <p class="mt-1 text-gray-600 dark:text-gray-400">Constrain the request body of one endpoint. OBP rejects non-conforming requests before the endpoint runs.</p>
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {#if data.choicesError}
        <p class="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100" data-testid="choices-error">
          The operation id list could not be loaded from OBP's resource docs: {data.choicesError}. You can still type an operation id.
        </p>
      {/if}
      <JsonSchemaValidationForm
        initial={{ operation_id: data.prefillOperationId, json_schema: "" }}
        operationChoices={data.operationChoices}
        submitLabel="Create validation"
        cancelHref="/json-schema-validations"
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
