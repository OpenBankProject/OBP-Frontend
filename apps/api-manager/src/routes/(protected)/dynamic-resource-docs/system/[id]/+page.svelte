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
  import { Bug, Wand2 } from "@lucide/svelte";
  import { formBridge } from "$lib/stores/formBridge.svelte";
  import type { PageData } from "./$types";
  import DynamicResourceDocForm, {
    type DynamicResourceDocFormValues,
  } from "$lib/components/DynamicResourceDocForm.svelte";
  import {
    extractErrorFromResponse,
    formatErrorForDisplay,
    logErrorDetails,
  } from "$lib/utils/errorHandler";

  let { data }: { data: PageData } = $props();

  const doc = $derived(data.doc);
  const docId = $derived(doc?.dynamic_resource_doc_id);

  let deleteError = $state<string | null>(null);
  let successMessage = $state<string | null>(null);
  let isDeleting = $state(false);

  async function handleSubmit(values: DynamicResourceDocFormValues) {
    if (!docId) throw new Error("Missing doc id");
    successMessage = null;
    const response = await fetch(
      `/proxy/obp/v4.0.0/management/dynamic-resource-docs/${encodeURIComponent(docId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      },
    );
    if (!response.ok) {
      const errorDetails = await extractErrorFromResponse(
        response,
        "Failed to update dynamic resource doc",
      );
      logErrorDetails("Update Dynamic Resource Doc", errorDetails);
      throw new Error(formatErrorForDisplay(errorDetails));
    }
    if (response.status === 202) {
      // Maker/checker is on: the change is queued, the live endpoint is unchanged until approved.
      const created = await response.json().catch(() => ({}));
      successMessage = created?.dynamic_change_request_id
        ? `Submitted for approval as change request ${created.dynamic_change_request_id}. The live endpoint is unchanged until a checker approves it.`
        : "Submitted for approval. The live endpoint is unchanged until a checker approves it.";
      return;
    }
    successMessage = "Saved.";
  }

  // ---- Opey side panel: same wiring as the Create page ------------------------
  // Opey drafts into the form through the client-executed set_form_fields tool; the
  // form registers itself on formBridge and reports which fields it applied.
  const clientTools = {
    set_form_fields: async (toolInput: Record<string, any>) =>
      formBridge.apply(toolInput?.fields ?? {}),
  };
  const clientContext = () => formBridge.describe();

  // The chat instance, so the form's Compile → Opey → Compile loop can push a fix request into it.
  let opeyChat = $state<{ sendUserMessage: (text: string) => Promise<boolean> } | undefined>();
  const onFixWithOpey = async (prompt: string) => (opeyChat ? opeyChat.sendUserMessage(prompt) : false);

  const suggestedQuestions: SuggestedQuestion[] = [
    {
      questionString: "Review the current method_body and improve its error handling without changing what it returns.",
      pillTitle: "Improve error handling",
      icon: Wand2,
    },
    {
      questionString: "Explain what this endpoint does, step by step, from the current form values.",
      pillTitle: "Explain this endpoint",
      icon: Bug,
    },
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
      "I can see this Resource Doc's fields. Ask me to change the Scala method body, tighten validation, or explain what it does. You review every value before saving.",
  };

  async function handleDelete() {
    if (!docId) return;
    deleteError = null;
    successMessage = null;
    isDeleting = true;
    try {
      const response = await fetch(
        `/proxy/obp/v4.0.0/management/dynamic-resource-docs/${encodeURIComponent(docId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) {
        const errorDetails = await extractErrorFromResponse(
          response,
          "Failed to delete dynamic resource doc",
        );
        logErrorDetails("Delete Dynamic Resource Doc", errorDetails);
        deleteError = formatErrorForDisplay(errorDetails);
        return;
      }
      await goto("/dynamic-resource-docs/system");
    } finally {
      isDeleting = false;
    }
  }
</script>

<svelte:head>
  <title>Edit System Dynamic Resource Doc - API Manager</title>
</svelte:head>

<div class="container mx-auto max-w-7xl px-4 py-8">
  <div class="mb-6">
    <a
      href="/dynamic-resource-docs/system"
      class="mb-4 inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
    >
      ← Back to System Dynamic Resource Docs
    </a>
    <div class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {doc?.partial_function_name || "Dynamic Resource Doc"}
        </h1>
        <p class="mt-1 text-gray-600 dark:text-gray-400">
          <span class="font-mono">{doc?.request_verb} {doc?.request_url}</span>
        </p>
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-500">
          Served at <code class="rounded bg-gray-100 px-1 dark:bg-gray-900">/obp/dynamic-resource-doc{doc?.request_url}</code>
          · id <code class="rounded bg-gray-100 px-1 dark:bg-gray-900">{docId}</code>
        </p>
      </div>
      <button
        type="button"
        onclick={handleDelete}
        disabled={isDeleting}
        data-testid="delete-btn"
        class="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
    </div>
  </div>

  {#if deleteError}
    <div class="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300" data-testid="delete-error">
      {deleteError}
    </div>
  {/if}
  {#if successMessage}
    <div class="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300" data-testid="success-message">
      {successMessage}
    </div>
  {/if}

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]">
    <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
    {#key docId}
      <DynamicResourceDocForm initial={doc} onSubmit={handleSubmit} submitLabel="Save Changes" {onFixWithOpey}>
        {#snippet cancel()}
          <a
            href="/dynamic-resource-docs/system"
            class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </a>
        {/snippet}
      </DynamicResourceDocForm>
    {/key}
    </div>

    <!-- Opey pane: OpeyChat requires a definite height all the way down -->
    <aside class="lg:sticky lg:top-4" data-testid="opey-form-pane">
      <div
        class="h-[36rem] w-full overflow-hidden rounded-lg border border-gray-200 shadow-sm lg:h-[calc(100vh-8rem)] dark:border-gray-700"
      >
        <OpeyChat
          bind:this={opeyChat}
          {opeyChatOptions}
          userAuthenticated={!!page.data.userId}
          {clientTools}
          {clientContext}
        />
      </div>
    </aside>
  </div>
</div>
